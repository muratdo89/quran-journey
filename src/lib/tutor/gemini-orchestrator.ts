import type { DashboardStateSnapshot, ProgressRepository } from "@/lib/db/types";
import { getWordByLocation } from "@/lib/content/canonical-loader";
import { toTurkishReading } from "@/lib/content/turkish-reading";
import {
  buildTodayTutorBrief,
  checkVocabularyAnswerMatch,
  evaluateCanonicalRecitation,
  getNextReadingWarmup,
  getNextTajweedWarmup,
  getNextVocabularyQuizItem,
  getVerseStudyCard,
  lookupCanonicalInfo,
  persistTutorProgress,
  resolveNavigationRequest,
} from "./tools";
import { synthesizeTurkishTeacherAudio } from "./gemini-tts";
import type {
  TutorAudioCue,
  TutorRecitationCheck,
  TutorSessionState,
  TutorStageCard,
  TutorTurnRequest,
  TutorTurnResponse,
} from "./types";

const MAX_HISTORY = 10;

function appendHistory(
  history: TutorSessionState["history"],
  userText: string | undefined,
  replyTr: string
): TutorSessionState["history"] {
  const next = [...history];
  if (userText && userText.trim()) {
    next.push({ role: "user", text: userText.trim() });
  }
  next.push({ role: "assistant", text: replyTr });
  return next.slice(-MAX_HISTORY);
}

/**
 * Deterministic, patient, canonical-grounded Turkish teacher turn handler.
 * Drives the exact agreed session flow (Welcome -> optional Reading/Tajweed warmup ->
 * Vocabulary -> Hifz Listen & Recite -> Wrap up) and is also used as the structured
 * state backbone when Gemini 2.5 Flash generates conversational coaching replies.
 */
export async function runGuidedTutorStep(params: {
  request: TutorTurnRequest;
  snapshot: DashboardStateSnapshot;
  repo: ProgressRepository;
}): Promise<{
  baseReplyTr: string;
  isOpenQuestion?: boolean;
  expectingLanguage: "tr" | "ar";
  stageCard: TutorStageCard | null;
  audioCue: TutorAudioCue | null;
  recitationCheck?: TutorRecitationCheck;
  suggestedVoiceCommandsTr: string[];
  nextState: TutorSessionState;
}> {
  const { request, snapshot, repo } = params;
  const reciterId = request.reciterId ?? snapshot.preferences.preferredReciterId ?? 12;
  const state: TutorSessionState = {
    ...request.sessionState,
    playbackRate: request.sessionState.playbackRate ?? 1,
    askedWordLocations: [...request.sessionState.askedWordLocations],
    history: [...request.sessionState.history],
  };

  const withRate = (cue: TutorAudioCue | null, repeatCount = 1): TutorAudioCue | null =>
    cue ? { ...cue, playbackRate: state.playbackRate, repeatCount } : null;

  const rawText = (request.userText ?? "").trim();
  const low = rawText.toLocaleLowerCase("tr-TR");

  // 1. Opening welcome turn (synced with learner's HifzStore active page when provided)
  if (request.action === "start" || (state.phase === "welcome" && !rawText)) {
    const targetPage = request.hifzActivePage ?? state.currentPageNumber;
    const { card, firstVerseKey } = buildTodayTutorBrief(snapshot, targetPage);
    state.currentPageNumber = card.pageNumber;
    state.currentVerseKey = firstVerseKey;
    state.phase = "welcome";

    const reviewPagesCount = request.hifzReviewPages?.length ?? 0;
    const reviewNote =
      reviewPagesCount > 0 ? `Ayrıca ${reviewPagesCount} tekrar sayfan var. ` : "";
    const warmupNote =
      card.remainingReadingModules > 0
        ? "Kısa bir okuma ısınmasıyla başlayıp "
        : card.remainingTajweedLessons > 0
          ? "Kısa bir tecvid hatırlatmasıyla başlayıp "
          : "";

    const baseReplyTr = `Selamün aleyküm ${snapshot.profile.displayName || "hoş geldin"}. Bugün Sayfa ${card.pageNumber} (${card.surahNameTr}) ile devam ediyoruz. ${reviewNote}${warmupNote}kelime ve ezber çalışmasıyla yaklaşık ${card.estimatedMinutes} dakikalık bir ders öneriyorum. Normal dersle mi başlayalım, yoksa 5 dakikalık hızlı tekrar mı yapalım?`;

    return {
      baseReplyTr,
      expectingLanguage: "tr",
      stageCard: card,
      audioCue: null,
      suggestedVoiceCommandsTr: ["Normal başlayalım", "5 dakika yapalım", "Direkt ezbere geç"],
      nextState: state,
    };
  }

  // Global voice command: Wrap up
  if (/(?:^|\s)(bitir|kapat|yeter|bugünlük bu kadar|dur artık)(?:\s|$|[.,!?])/.test(low)) {
    state.phase = "wrap_up";
    const summaryPointsTr = [
      `Kelime tekrarı: ${state.vocabDoneCount} kelime`,
      `Ezber çalışması: ${state.versesDoneCount} ayet`,
      state.warmupDone ? "Okuma / Tecvid ısınması tamamlandı" : "Odaklı kısa tekrar yapıldı",
    ];
    return {
      baseReplyTr: `Maşallah, bugünkü çalışmamızı tamamladık. Toplam ${state.vocabDoneCount} kelime ve ${state.versesDoneCount} ayet üzerinde durduk. Yarın Sayfa ${state.currentPageNumber} ile kaldığımız yerden devam ederiz. Allah zihnini açık etsin.`,
      expectingLanguage: "tr",
      stageCard: {
        kind: "summary",
        completedCount: state.vocabDoneCount + state.versesDoneCount,
        summaryPointsTr,
        nextPageNumber: state.currentPageNumber,
      },
      audioCue: null,
      suggestedVoiceCommandsTr: ["Yeni ders başlat"],
      nextState: state,
    };
  }

  // Global voice command: Playback speed control ("yavaş oku", "yavaşlat", "normal hız")
  if (/(?:yavaş|ağır|normal hız|hızlandır)/.test(low) && !/(?:^|\s)hızlı tekrar/.test(low)) {
    const wantsSlow = /(?:yavaş|ağır)/.test(low);
    state.playbackRate = wantsSlow ? 0.75 : 1;
    const study = getVerseStudyCard({
      verseKey: state.currentVerseKey,
      pageNumber: state.currentPageNumber,
      reciterId,
      hideArabicText: false,
    });
    return {
      baseReplyTr: wantsSlow
        ? "Tamam, okuyucu hızını yavaşlattım (0.75x). Ayeti bu hızda tekrar dinleyelim."
        : "Tamam, okuyucu hızını normale (1x) aldım. Tekrar dinleyelim.",
      expectingLanguage: "tr",
      stageCard: study.card,
      audioCue: withRate(study.audioCue),
      suggestedVoiceCommandsTr: ["Okumaya hazırım", "3 kere dinlet", "Sonraki ayet"],
      nextState: state,
    };
  }

  // Global voice command: Multi-repeat recitation ("3 kere dinlet", "2 kez tekrar et")
  const repeatMatch = /\b(2|3|iki|üç)\s*(?:kere|kez|defa)\b/.exec(low);
  if (repeatMatch && (state.phase === "hifz_listen" || state.phase === "hifz_recite" || state.phase === "welcome")) {
    const count = repeatMatch[1] === "2" || repeatMatch[1] === "iki" ? 2 : 3;
    state.phase = "hifz_listen";
    const study = getVerseStudyCard({
      verseKey: state.currentVerseKey,
      pageNumber: state.currentPageNumber,
      reciterId,
      hideArabicText: false,
    });
    return {
      baseReplyTr: `Tabii, ${study.card.surahNameTr} ${study.card.verseKey} ayetini art arda ${count} kez dinletiyorum.`,
      expectingLanguage: "tr",
      stageCard: study.card,
      audioCue: withRate(study.audioCue, count),
      suggestedVoiceCommandsTr: ["Okumaya hazırım", "Yavaş oku", "Sonraki ayet"],
      nextState: state,
    };
  }

  // Global voice command: Natural Surah or Mushaf page jump ("Sayfa 604", "Bakara suresini aç", "Yasin 5. ayet")
  if (state.phase !== "hifz_recite" || /[ğüşöçıİĞÜŞÖÇ]/.test(rawText) || /\bsayfa\b|\bsure/i.test(low)) {
    const nav = resolveNavigationRequest(rawText);
    if (nav) {
      state.currentPageNumber = nav.pageNumber;
      state.currentVerseKey = nav.verseKey;
      state.phase = "hifz_listen";
      state.attemptCount = 0;
      const study = getVerseStudyCard({
        verseKey: nav.verseKey,
        pageNumber: nav.pageNumber,
        reciterId,
        hideArabicText: false,
      });
      return {
        baseReplyTr: `Tabii, ${nav.labelTr} açtım. Önce referans hocamızdan dinleyelim.`,
        expectingLanguage: "tr",
        stageCard: study.card,
        audioCue: withRate(study.audioCue),
        suggestedVoiceCommandsTr: ["Okumaya hazırım", "3 kere dinlet", "Anlamı ne?"],
        nextState: state,
      };
    }
  }

  // Global voice command: Free-form Turkish question (stay in current phase & let Gemini answer!)
  const isQuestion =
    rawText.includes("?") ||
    /(?:^|\s)(neden|niçin|nasıl|nedir|ne demek|anlamı ne|meali ne|kökü ne|nerede|açıkla|anlatır mısın|anlat)\b/.test(
      low
    );
  if (isQuestion && state.phase !== "vocabulary") {
    const lookupQuery = state.currentVerseKey ?? rawText;
    const info = lookupCanonicalInfo(lookupQuery);
    const study = state.currentVerseKey
      ? getVerseStudyCard({
          verseKey: state.currentVerseKey,
          pageNumber: state.currentPageNumber,
          reciterId,
          hideArabicText: false,
        })
      : null;

    return {
      baseReplyTr: info.found
        ? `${info.summaryTr} Hazırsan devam edelim mi?`
        : "Güzel bir soru. Mevcut dersimizle bağlantılı olarak kısaca açıklayayım, hazırsan devam edelim.",
      isOpenQuestion: true,
      expectingLanguage: "tr",
      stageCard: study?.card ?? null,
      audioCue: null,
      suggestedVoiceCommandsTr: ["Devam edelim", "Tekrar dinle", "Okumaya hazırım"],
      nextState: state,
    };
  }

  // Explicit jump to Reading or Tajweed module
  if (/(?:^|\s)(elifba|okuma dersi|harf)/.test(low)) {
    const warmup = getNextReadingWarmup(snapshot);
    if (warmup) {
      state.phase = "reading";
      state.currentReadingModuleId = warmup.card.moduleId;
      return {
        baseReplyTr: `Arapça okuma ısınmasına geçiyoruz: ${warmup.card.titleTr}. ${warmup.card.explanationTr} Örnek sesi dinleyelim; anladıysan "tamam" demen yeterli.`,
        expectingLanguage: "tr",
        stageCard: warmup.card,
        audioCue: withRate(warmup.audioCue),
        suggestedVoiceCommandsTr: ["Tamam, devam", "Tekrar dinle", "Kelimelere geç"],
        nextState: state,
      };
    }
  }

  if (/(?:^|\s)(tecvid|mahreç|med|gunne|kalkale)/.test(low)) {
    const tajweed = getNextTajweedWarmup(snapshot);
    if (tajweed) {
      state.phase = "tajweed";
      state.currentTajweedSlug = tajweed.card.slug;
      return {
        baseReplyTr: `Tecvid dersimiz: ${tajweed.card.nameTr}. ${tajweed.card.summaryTr} Şimdi referans örneği dinleyelim, kulak aşinalığı kazanalım.`,
        expectingLanguage: "tr",
        stageCard: tajweed.card,
        audioCue: withRate(tajweed.audioCue),
        suggestedVoiceCommandsTr: ["Tamam, geçelim", "Tekrar dinle"],
        nextState: state,
      };
    }
  }

  // 2. From welcome -> choose pace & enter first step
  if (state.phase === "welcome") {
    const wantsShort = /\b(5|beş|kısa|hızlı|toparlanma)\b/.test(low);
    const wantsDirectHifz = /\b(direkt ezber|ezbere geç|hıfz)\b/.test(low);
    const wantsDirectVocab = /\b(kelime)\b/.test(low);

    state.pace = wantsShort ? "short" : "normal";

    if (wantsDirectHifz) {
      return enterHifzListen(state, reciterId, "Harika, doğrudan Hıfz çalışmasına geçiyoruz.");
    }

    if (wantsShort || wantsDirectVocab) {
      return enterVocabularyQuiz(
        state,
        snapshot,
        wantsShort
          ? "Tamam, 5 dakikalık sakin bir tekrar yapalım. Önce bir kelimeyle başlayalım."
          : "Kelime tekrarıyla başlayalım."
      );
    }

    // Normal mode: brief reading or tajweed warmup if gaps remain, otherwise vocabulary
    const readingWarmup = getNextReadingWarmup(snapshot);
    if (readingWarmup) {
      state.phase = "reading";
      state.currentReadingModuleId = readingWarmup.card.moduleId;
      return {
        baseReplyTr: `Güzel, normal dersle başlıyoruz. Önce 2 dakikalık okuma ısınması: ${readingWarmup.card.titleTr}. ${readingWarmup.card.explanationTr} Örnek sesi dinleyelim; hazırsan "tamam" de.`,
        expectingLanguage: "tr",
        stageCard: readingWarmup.card,
        audioCue: readingWarmup.audioCue,
        suggestedVoiceCommandsTr: ["Tamam, devam", "Tekrar dinle", "Kelimelere geç"],
        nextState: state,
      };
    }

    const tajweedWarmup = getNextTajweedWarmup(snapshot);
    if (tajweedWarmup) {
      state.phase = "tajweed";
      state.currentTajweedSlug = tajweedWarmup.card.slug;
      return {
        baseReplyTr: `Okuma modüllerin harika, kısa bir tecvid ısınmasıyla başlayalım: ${tajweedWarmup.card.nameTr}. ${tajweedWarmup.card.summaryTr} Şimdi örneği dinleyelim.`,
        expectingLanguage: "tr",
        stageCard: tajweedWarmup.card,
        audioCue: tajweedWarmup.audioCue,
        suggestedVoiceCommandsTr: ["Tamam, devam", "Tekrar dinle"],
        nextState: state,
      };
    }

    return enterVocabularyQuiz(state, snapshot, "Harika, hemen bugünkü kelime tekrarıyla başlayalım.");
  }

  // 3. Reading or Tajweed warmup completion
  if (state.phase === "reading" || state.phase === "tajweed") {
    if (/\b(tekrar|dinle|bir daha)\b/.test(low)) {
      const warmup =
        state.phase === "reading"
          ? getNextReadingWarmup(snapshot)
          : getNextTajweedWarmup(snapshot);
      return {
        baseReplyTr: "Tabii, örnek sesi tekrar dinleyelim.",
        expectingLanguage: "tr",
        stageCard: warmup?.card ?? null,
        audioCue: warmup?.audioCue ?? null,
        suggestedVoiceCommandsTr: ["Tamam, devam", "Kelimelere geç"],
        nextState: state,
      };
    }

    if (state.phase === "reading" && state.currentReadingModuleId) {
      await persistTutorProgress(repo, {
        kind: "complete_reading",
        moduleId: state.currentReadingModuleId,
      });
    } else if (state.phase === "tajweed" && state.currentTajweedSlug) {
      await persistTutorProgress(repo, {
        kind: "complete_tajweed",
        slug: state.currentTajweedSlug,
      });
    }
    state.warmupDone = true;

    return enterVocabularyQuiz(
      state,
      snapshot,
      "Harika, ısınmayı kaydettim. Şimdi kelime hazinesi tekrarına geçelim."
    );
  }

  // 4. Vocabulary Quiz (oral Arabic -> Turkish meaning recall)
  if (state.phase === "vocabulary") {
    if (/(?:^|\s)(ezber|hıfz|ayet|mushaf)/.test(low)) {
      return enterHifzListen(state, reciterId, "Tamam, şimdi ayet ezberine geçelim.");
    }

    if (/\b(tekrar|dinle|bir daha)\b/.test(low) && state.currentWordLocation) {
      const word = getWordByLocation(state.currentWordLocation);
      if (word) {
        return {
          baseReplyTr: "Kelimenin sesini tekrar dinletiyorum. Türkçe anlamını hatırlayabiliyor musun?",
          expectingLanguage: "tr",
          stageCard: {
            kind: "vocabulary_quiz",
            cardId: state.currentCardId,
            wordLocation: word.location,
            verseKey: word.verseKey,
            surahNameTr: word.surahNameTr,
            textUthmani: word.textUthmani,
            turkishReading: word.transliteration ? toTurkishReading(word.transliteration) : null,
            meaningTr: word.translationTr,
            verseTranslationTr: word.verseTranslationTr,
            rootArabic: word.morphology.rootArabic,
            audioUrl: word.audioUrl,
            revealed: false,
          },
          audioCue: word.audioUrl
            ? { kind: "word", url: word.audioUrl, labelTr: "Kelime telaffuzu", autoPlay: true }
            : null,
          suggestedVoiceCommandsTr: ["Hatırlayamadım", "Ezbere geç"],
          nextState: state,
        };
      }
    }

    const currentWord = state.currentWordLocation
      ? getWordByLocation(state.currentWordLocation)
      : undefined;

    if (currentWord) {
      const gaveUp = /\b(bilmiyorum|hatırlamıyorum|hatırlayamadım|geç|söyle|ipucu)\b/.test(low);
      const isCorrect = !gaveUp && checkVocabularyAnswerMatch(rawText, currentWord.translationTr);

      // Patient 2-step coaching: on 1st miss (not explicit skip), give gentle hint + replay once
      if (!isCorrect && !gaveUp && state.attemptCount === 0) {
        state.attemptCount = 1;
        const hint = currentWord.morphology.rootArabic
          ? `İpucu vereyim: kökü ${currentWord.morphology.rootArabic}. Bir kez daha dinleyip dener misin?`
          : `Küçük bir ipucu: ${currentWord.surahNameTr} suresi ${currentWord.verseKey} ayetinde geçiyor. Tekrar dinleyip tahmin etmek ister misin?`;

        return {
          baseReplyTr: `Yaklaştın ama tam değil. ${hint}`,
          expectingLanguage: "tr",
          stageCard: {
            kind: "vocabulary_quiz",
            cardId: state.currentCardId,
            wordLocation: currentWord.location,
            verseKey: currentWord.verseKey,
            surahNameTr: currentWord.surahNameTr,
            textUthmani: currentWord.textUthmani,
            turkishReading: currentWord.transliteration ? toTurkishReading(currentWord.transliteration) : null,
            meaningTr: currentWord.translationTr,
            verseTranslationTr: currentWord.verseTranslationTr,
            rootArabic: currentWord.morphology.rootArabic,
            audioUrl: currentWord.audioUrl,
            revealed: false,
          },
          audioCue: currentWord.audioUrl
            ? { kind: "word", url: currentWord.audioUrl, labelTr: "Kelime tekrarı", autoPlay: true }
            : null,
          suggestedVoiceCommandsTr: ["Söyle geçelim", "Tekrar dinle"],
          nextState: state,
        };
      }

      // Record FSRS review
      await persistTutorProgress(repo, {
        kind: "grade_vocab",
        wordLocation: currentWord.location,
        cardId: state.currentCardId,
        correct: isCorrect,
      });
      state.vocabDoneCount += 1;
      state.attemptCount = 0;

      const feedback = isCorrect
        ? `Çok güzel, doğru! "${currentWord.translationTr}" demek.`
        : `Hiç sorun değil, anlamı "${currentWord.translationTr}". Yarın tekrar karşına çıkaracağım, böylece yerleşecek.`;

      const targetVocabCount = state.pace === "short" ? 2 : 3;
      if (state.vocabDoneCount >= targetVocabCount) {
        return enterHifzListen(
          state,
          reciterId,
          `${feedback} Kelime tekrarımız tamam; şimdi Hıfz ayet çalışmasına geçelim.`
        );
      }

      return enterVocabularyQuiz(state, snapshot, `${feedback} Sıradaki kelimeye geçiyoruz.`);
    }

    return enterHifzListen(state, reciterId, "Şimdi Hıfz ayet çalışmasına geçelim.");
  }

  // 5. Hifz Listen step -> wait for learner ready or replay
  if (state.phase === "hifz_listen") {
    if (/\b(tekrar|dinle|bir daha)\b/.test(low)) {
      const study = getVerseStudyCard({
        verseKey: state.currentVerseKey,
        pageNumber: state.currentPageNumber,
        reciterId,
        hideArabicText: false,
      });
      return {
        baseReplyTr: "Ayeti referans hocamızdan bir kez daha dinleyelim.",
        expectingLanguage: "tr",
        stageCard: study.card,
        audioCue: study.audioCue,
        suggestedVoiceCommandsTr: ["Okumaya hazırım", "Tekrar dinle", "Anlamı ne?"],
        nextState: state,
      };
    }

    if (/\b(sonraki|geç|atla)\b/.test(low)) {
      const study = getVerseStudyCard({
        verseKey: state.currentVerseKey,
        pageNumber: state.currentPageNumber,
        reciterId,
        hideArabicText: false,
      });
      if (study.nextVerseKeyOnPage) {
        state.currentVerseKey = study.nextVerseKeyOnPage;
        state.attemptCount = 0;
        return enterHifzListen(state, reciterId, "Sonraki ayete geçiyoruz.");
      }
    }

    // Move to Arabic recitation test!
    state.phase = "hifz_recite";
    state.attemptCount = 0;
    const reciteCard = getVerseStudyCard({
      verseKey: state.currentVerseKey,
      pageNumber: state.currentPageNumber,
      reciterId,
      hideArabicText: true,
    });
    return {
      baseReplyTr: "Şimdi sıra sende. Ayeti gizledim; hazır olduğunda sesli okuyabilirsin, seni dinliyorum.",
      expectingLanguage: "ar",
      stageCard: reciteCard.card,
      audioCue: null,
      suggestedVoiceCommandsTr: ["Tekrar dinle", "Ayeti göster", "Sonraki ayet"],
      nextState: state,
    };
  }

  // 6. Hifz Recite step -> evaluate Arabic transcript or handle Turkish command
  if (state.phase === "hifz_recite") {
    if (/\b(tekrar|dinle|göster|ipucu)\b/.test(low)) {
      state.phase = "hifz_listen";
      const study = getVerseStudyCard({
        verseKey: state.currentVerseKey,
        pageNumber: state.currentPageNumber,
        reciterId,
        hideArabicText: false,
      });
      return {
        baseReplyTr: "Ayeti açtım ve referans hocadan tekrar dinletiyorum.",
        expectingLanguage: "tr",
        stageCard: study.card,
        audioCue: study.audioCue,
        suggestedVoiceCommandsTr: ["Okumaya hazırım", "Sonraki ayet"],
        nextState: state,
      };
    }

    const transcript = (request.recitationTranscript ?? rawText).trim();
    const activeVerseKey = state.currentVerseKey ?? "1:1";
    const check = evaluateCanonicalRecitation(activeVerseKey, transcript);

    if (check && check.wordMatchRatio >= 0.8) {
      await persistTutorProgress(repo, {
        kind: "verse_outcome",
        verseKey: activeVerseKey,
        outcome: "clean_recall",
      });
      await persistTutorProgress(repo, {
        kind: "mark_page",
        pageNumber: state.currentPageNumber,
      });
      state.versesDoneCount += 1;
      state.attemptCount = 0;

      const currentStudy = getVerseStudyCard({
        verseKey: activeVerseKey,
        pageNumber: state.currentPageNumber,
        reciterId,
        hideArabicText: false,
        recitationCheck: check,
      });

      const targetVerses = state.pace === "short" ? 1 : 2;
      if (state.versesDoneCount >= targetVerses || !currentStudy.nextVerseKeyOnPage) {
        state.phase = "wrap_up";
        return {
          baseReplyTr: `Maşallah! Kelime sırası %${Math.round(check.wordMatchRatio * 100)} eşleşti. Bugünkü dersimizi güzelce tamamladık. Tecvid ve mahreç detaylarını ara ara referans okuyucuyla karşılaştırmayı unutma.`,
          expectingLanguage: "tr",
          stageCard: currentStudy.card,
          audioCue: null,
          recitationCheck: check,
          suggestedVoiceCommandsTr: ["Bir ayet daha çalışalım", "Dersi bitir"],
          nextState: state,
        };
      }

      state.currentVerseKey = currentStudy.nextVerseKeyOnPage;
      state.phase = "hifz_listen";
      const nextStudy = getVerseStudyCard({
        verseKey: state.currentVerseKey,
        pageNumber: state.currentPageNumber,
        reciterId,
        hideArabicText: false,
      });
      return {
        baseReplyTr: `Çok güzel, kelime sırası %${Math.round(check.wordMatchRatio * 100)} doğru. Şimdi sıradaki ayeti dinleyelim.`,
        expectingLanguage: "tr",
        stageCard: nextStudy.card,
        audioCue: nextStudy.audioCue,
        recitationCheck: check,
        suggestedVoiceCommandsTr: ["Okumaya hazırım", "Tekrar dinle"],
        nextState: state,
      };
    }

    // Patient 2-step correction on missed words
    if (state.attemptCount === 0) {
      state.attemptCount = 1;
      const study = getVerseStudyCard({
        verseKey: activeVerseKey,
        pageNumber: state.currentPageNumber,
        reciterId,
        hideArabicText: false,
        recitationCheck: check ?? undefined,
      });
      return {
        baseReplyTr:
          "Birkaç kelimede takıldın, hiç sorun değil. Ayeti ekranda açtım, referans hocadan bir kez daha dinleyip tekrar okuyalım.",
        expectingLanguage: "ar",
        stageCard: study.card,
        audioCue: study.audioCue,
        recitationCheck: check ?? undefined,
        suggestedVoiceCommandsTr: ["Tekrar okudum", "Yarın tekrar edelim"],
        nextState: state,
      };
    }

    // 2nd miss -> save calmly as partial_recall and move forward without guilt
    await persistTutorProgress(repo, {
      kind: "verse_outcome",
      verseKey: activeVerseKey,
      outcome: "partial_recall",
    });
    state.versesDoneCount += 1;
    state.attemptCount = 0;

    const currentStudy = getVerseStudyCard({
      verseKey: activeVerseKey,
      pageNumber: state.currentPageNumber,
      reciterId,
      hideArabicText: false,
      recitationCheck: check ?? undefined,
    });
    state.phase = "wrap_up";
    return {
      baseReplyTr:
        "Hiç kendini zorlama, bu ayeti yarınki tekrara öncelikli olarak ekledim. Bugünkü adımı tamamladın; düzenli tekrar ile oturacak.",
      expectingLanguage: "tr",
      stageCard: currentStudy.card,
      audioCue: null,
      recitationCheck: check ?? undefined,
      suggestedVoiceCommandsTr: ["Bir ayet daha", "Dersi bitir"],
      nextState: state,
    };
  }

  // 7. Wrap-up -> allow continuing another verse
  if (state.phase === "wrap_up" && /\b(bir ayet|devam|yeni)\b/.test(low)) {
    const study = getVerseStudyCard({
      verseKey: state.currentVerseKey,
      pageNumber: state.currentPageNumber,
      reciterId,
      hideArabicText: false,
    });
    if (study.nextVerseKeyOnPage) {
      state.currentVerseKey = study.nextVerseKeyOnPage;
    }
    return enterHifzListen(state, reciterId, "Harika, bir ayet daha çalışalım.");
  }

  // Default gentle continuation
  return enterHifzListen(state, reciterId, "Sayfadaki ayetle devam edelim.");
}

function enterVocabularyQuiz(
  state: TutorSessionState,
  snapshot: DashboardStateSnapshot,
  introTr: string
) {
  const nextVocab = getNextVocabularyQuizItem(
    snapshot,
    state.currentPageNumber,
    state.askedWordLocations
  );
  if (!nextVocab) {
    return enterHifzListen(state, snapshot.preferences.preferredReciterId ?? 12, introTr);
  }
  state.phase = "vocabulary";
  state.currentWordLocation = nextVocab.card.wordLocation;
  state.currentCardId = nextVocab.card.cardId;
  state.attemptCount = 0;
  state.askedWordLocations.push(nextVocab.card.wordLocation);

  return {
    baseReplyTr: `${introTr} Kelimeyi dinletiyorum; Türkçe anlamı neydi?`,
    expectingLanguage: "tr" as const,
    stageCard: nextVocab.card,
    audioCue: nextVocab.audioCue,
    suggestedVoiceCommandsTr: ["Tekrar dinle", "Hatırlayamadım", "Ezbere geç"],
    nextState: state,
  };
}

function enterHifzListen(state: TutorSessionState, reciterId: number, introTr: string) {
  state.phase = "hifz_listen";
  state.attemptCount = 0;
  const study = getVerseStudyCard({
    verseKey: state.currentVerseKey,
    pageNumber: state.currentPageNumber,
    reciterId,
    hideArabicText: false,
  });
  state.currentVerseKey = study.card.verseKey;

  return {
    baseReplyTr: `${introTr} Şimdi ${study.card.surahNameTr} suresi ${study.card.verseKey} ayetini hocamızdan dinleyelim. Bitince hazırsan "hazırım" demen yeterli.`,
    expectingLanguage: "tr" as const,
    stageCard: study.card,
    audioCue: study.audioCue ? { ...study.audioCue, playbackRate: state.playbackRate } : null,
    suggestedVoiceCommandsTr: ["Okumaya hazırım", "3 kere dinlet", "Yavaş oku"],
    nextState: state,
  };
}

/**
 * Enhances the canonical-grounded teacher turn with Google Gemini Flash so the
 * Turkish teacher sounds warm, natural, and responsive to free-form questions while
 * remaining 100% bound to verified canonical data (zero Quran/meaning hallucination).
 */
export async function orchestrateTutorTurn(params: {
  request: TutorTurnRequest;
  snapshot: DashboardStateSnapshot;
  repo: ProgressRepository;
}): Promise<TutorTurnResponse> {
  const step = await runGuidedTutorStep(params);
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  let replyTr = step.baseReplyTr;
  let providerMode: "gemini" | "local_guided" = "local_guided";
  let teacherAudioDataUrl: string | null = null;
  let providerDiagnosticTr: string | null = null;

  if (geminiKey) {
    try {
      const systemPrompt = [
        "Sen 'Quran Journey' uygulamasının sabırlı, sakin ve teşvik edici Türkçe Kur'an ders çalıştırıcısısın.",
        "Kurallar:",
        "1. Yalnızca Türkçe konuş; Arapça ayet veya kelime okuma (Arapça telaffuz daima doğrulanmış okuyucu ses kaydından çalınır).",
        "2. Kendi hafızandan asla ayet metni, meal veya kelime kökü uydurma; yalnızca sana verilen DOĞRULANMIŞ BAĞLAM içindeki bilgileri kullan.",
        "3. Kıraat kelime kontrolünün tecvid ve mahreç doğruluğunu tek başına kanıtlamadığını koru.",
        "4. Yanıtın sesli okunacağı için kısa, doğal ve sıcak olsun (en fazla 2-3 kısa cümle, madde işareti veya markdown kullanma).",
      ].join("\n");

      const groundedContext = JSON.stringify({
        phase: step.nextState.phase,
        isOpenQuestion: Boolean(step.isOpenQuestion),
        userSaid: params.request.userText ?? params.request.recitationTranscript ?? "(oturum başlangıcı)",
        canonicalDraftReply: step.baseReplyTr,
        stageCardSummary: step.stageCard,
        recitationCheck: step.recitationCheck ?? null,
      });

      const taskInstruction = step.isOpenQuestion
        ? `DOĞRULANMIŞ BAĞLAM:\n${groundedContext}\n\nÖğrencinin sorduğu Türkçe soruya yalnızca bu doğrulanmış bağlamdaki bilgilere dayanarak kısa, anlaşılır ve sıcak bir cevap ver; sonunda derse devam etmek isteyip istemediğini sor.`
        : `DOĞRULANMIŞ BAĞLAM:\n${groundedContext}\n\nBu bağlamdaki tüm gerçekleri ve yönlendirmeyi koruyarak öğrenciye söyleyeceğin doğal, kısa Türkçe hoca cümlesini yaz.`;

      let lastErrStatus = 0;
      let succeeded = false;

      for (const model of ["gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-3.7-flash"] as const) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [
              ...step.nextState.history.slice(-6).map((m) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.text }],
              })),
              {
                role: "user",
                parts: [{ text: taskInstruction }],
              },
            ],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 180,
            },
          }),
        });

        if (res.ok) {
          const json = (await res.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const candidateText =
            json.candidates?.[0]?.content?.parts
              ?.map((p) => p.text ?? "")
              .join(" ")
              .replace(/[*_`#]/g, "")
              .trim() ?? "";

          if (candidateText.length >= 10) {
            replyTr = candidateText;
            providerMode = "gemini";
          }

          if (!params.request.skipInlineTts) {
            const tts = await synthesizeTurkishTeacherAudio(replyTr);
            if (tts.audioDataUrl) {
              teacherAudioDataUrl = tts.audioDataUrl;
            } else if (tts.errorTr) {
              providerDiagnosticTr = `${tts.errorTr} (Şimdilik tarayıcı sesi kullanılıyor.)`;
            }
          }
          succeeded = true;
          break;
        }

        lastErrStatus = res.status;
        if (res.status === 401 || res.status === 403) break;
      }

      if (!succeeded) {
        providerDiagnosticTr = `Gemini API hata döndürdü (HTTP ${lastErrStatus}); yerel rehber moduna geçildi.`;
      }
    } catch {
      providerDiagnosticTr = "Gemini API bağlantısı kurulamadı; yerel rehber modu aktif.";
    }
  }

  step.nextState.history = appendHistory(
    step.nextState.history,
    params.request.userText ?? params.request.recitationTranscript,
    replyTr
  );

  return {
    replyTr,
    phase: step.nextState.phase,
    expectingLanguage: step.expectingLanguage,
    stageCard: step.stageCard,
    audioCue: step.audioCue,
    teacherAudioDataUrl,
    providerDiagnosticTr,
    recitationCheck: step.recitationCheck,
    suggestedVoiceCommandsTr: step.suggestedVoiceCommandsTr,
    providerMode,
    sessionState: step.nextState,
  };
}
