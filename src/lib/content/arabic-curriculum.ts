export type ArabicReadingSkillCategory =
  | "letters"
  | "forms"
  | "harakat"
  | "sukun_shadda"
  | "tanween_madd"
  | "connected_reading";

export interface ArabicAlphabetLetter {
  order: number;
  isolated: string;
  initial: string;
  medial: string;
  final: string;
  nameTr: string;
  soundCategory: "ince" | "kalın" | "peltek" | "boğaz";
  nonConnecting: boolean;
  makhrajTipTr: string;
  exampleWordLocation: string;
  exampleArabic: string;
  exampleMeaningTr: string;
  exampleAudioUrl: string;
}

export interface ArabicLessonModule {
  id: string;
  order: number;
  category: ArabicReadingSkillCategory;
  titleTr: string;
  subtitleTr: string;
  explanationTr: string;
  commonMistakeTr: string;
  examples: Array<{
    arabic: string;
    labelTr: string;
    noteTr: string;
    isQuranicRef?: string;
    audioUrl?: string;
  }>;
  miniCheck: {
    promptTr: string;
    arabicPrompt: string;
    options: Array<{ id: string; labelTr: string; isCorrect: boolean }>;
  };
}

export interface PlacementQuestion {
  id: string;
  category: ArabicReadingSkillCategory;
  promptTr: string;
  arabicSample: string;
  options: Array<{ id: string; label: string; isCorrect: boolean }>;
  explanationTr: string;
}

export interface TajweedLesson {
  slug: string;
  order: number;
  nameTr: string;
  nameArabic: string;
  categoryTr: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  summaryTr: string;
  fatihaExample?: {
    verseKey: string;
    wordLocation: string;
    arabic: string;
    explanationTr: string;
    audioUrl?: string;
  };
  listenDiscriminationTipTr: string;
}

// Complete 28-letter Arabic alphabet with verified Quranic word audio from Fatiha & Juz Amma
export const ELIFBA_LETTERS: ArabicAlphabetLetter[] = [
  {
    order: 1,
    isolated: "ا",
    initial: "ا",
    medial: "ـا",
    final: "ـا",
    nameTr: "Elif",
    soundCategory: "ince",
    nonConnecting: true,
    makhrajTipTr: "Harekeli olduğunda hemze sesiyle okunur; harekesiz geldiğinde önceki üstünü uzatır.",
    exampleWordLocation: "112:1:3",
    exampleArabic: "ٱللَّهُ",
    exampleMeaningTr: "Allah",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/112_001_003.mp3",
  },
  {
    order: 2,
    isolated: "ب",
    initial: "بـ",
    medial: "ـبـ",
    final: "ـب",
    nameTr: "Bê",
    soundCategory: "ince",
    nonConnecting: false,
    makhrajTipTr: "İki dudağın hafifçe kapanıp açılmasıyla çıkan yumuşak b sesi.",
    exampleWordLocation: "1:1:1",
    exampleArabic: "بِسْمِ",
    exampleMeaningTr: "adıyla",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/001_001_001.mp3",
  },
  {
    order: 3,
    isolated: "ت",
    initial: "تـ",
    medial: "ـتـ",
    final: "ـت",
    nameTr: "Tê",
    soundCategory: "ince",
    nonConnecting: false,
    makhrajTipTr: "Dil ucu üst ön dişlerin köküne dokunur; ince ve hafif nefeslidir.",
    exampleWordLocation: "95:1:1",
    exampleArabic: "وَٱلتِّينِ",
    exampleMeaningTr: "İncire andolsun",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/095_001_001.mp3",
  },
  {
    order: 4,
    isolated: "ث",
    initial: "ثـ",
    medial: "ـثـ",
    final: "ـث",
    nameTr: "Sê (Peltek)",
    soundCategory: "peltek",
    nonConnecting: false,
    makhrajTipTr: "Dil ucu üst ön dişlerin ucuna hafifçe değdirilerek çıkan peltek s sesi.",
    exampleWordLocation: "102:1:2",
    exampleArabic: "ٱلتَّكَاثُرُ",
    exampleMeaningTr: "çoğaltma yarışı",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/102_001_002.mp3",
  },
  {
    order: 5,
    isolated: "ج",
    initial: "جـ",
    medial: "ـجـ",
    final: "ـج",
    nameTr: "Cîm",
    soundCategory: "ince",
    nonConnecting: false,
    makhrajTipTr: "Dil ortasının üst damağa tam temasıyla çıkan net c sesi.",
    exampleWordLocation: "110:1:2",
    exampleArabic: "جَآءَ",
    exampleMeaningTr: "geldiğinde",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/110_001_002.mp3",
  },
  {
    order: 6,
    isolated: "ح",
    initial: "حـ",
    medial: "ـحـ",
    final: "ـح",
    nameTr: "Hâ (Boğaz)",
    soundCategory: "boğaz",
    nonConnecting: false,
    makhrajTipTr: "Boğazın ortasından hışırtısız, temiz ve derinden gelen h sesi.",
    exampleWordLocation: "1:2:1",
    exampleArabic: "ٱلْحَمْدُ",
    exampleMeaningTr: "hamdolsun",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/001_002_001.mp3",
  },
  {
    order: 7,
    isolated: "خ",
    initial: "خـ",
    medial: "ـخـ",
    final: "ـخ",
    nameTr: "Hı (Kalın)",
    soundCategory: "kalın",
    nonConnecting: false,
    makhrajTipTr: "Boğazın üst kısmından kalın ve hafif hırıltılı çıkar.",
    exampleWordLocation: "113:2:4",
    exampleArabic: "خَلَقَ",
    exampleMeaningTr: "yarattığı",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/113_002_004.mp3",
  },
  {
    order: 8,
    isolated: "د",
    initial: "د",
    medial: "ـد",
    final: "ـد",
    nameTr: "Dâl",
    soundCategory: "ince",
    nonConnecting: true,
    makhrajTipTr: "Dil ucu üst ön diş etine basılır; kendinden sonraki harfe bitişmez.",
    exampleWordLocation: "1:4:3",
    exampleArabic: "ٱلدِّينِ",
    exampleMeaningTr: "Din (günü)",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/001_004_003.mp3",
  },
  {
    order: 9,
    isolated: "ذ",
    initial: "ذ",
    medial: "ـذ",
    final: "ـذ",
    nameTr: "Zêl (Peltek)",
    soundCategory: "peltek",
    nonConnecting: true,
    makhrajTipTr: "Dil ucu üst dişlerin ucuna dokunarak çıkan peltek z; sonrasına bitişmez.",
    exampleWordLocation: "1:7:2",
    exampleArabic: "ٱلَّذِينَ",
    exampleMeaningTr: "onlar ki",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/001_007_002.mp3",
  },
  {
    order: 10,
    isolated: "ر",
    initial: "ر",
    medial: "ـر",
    final: "ـر",
    nameTr: "Râ",
    soundCategory: "kalın",
    nonConnecting: true,
    makhrajTipTr: "Üstün/ötrede kalın, esrede ince okunur; kendinden sonraya bitişmez.",
    exampleWordLocation: "1:2:3",
    exampleArabic: "رَبِّ",
    exampleMeaningTr: "Rabbi",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/001_002_003.mp3",
  },
  {
    order: 11,
    isolated: "ز",
    initial: "ز",
    medial: "ـز",
    final: "ـز",
    nameTr: "Zây",
    soundCategory: "ince",
    nonConnecting: true,
    makhrajTipTr: "Keskin ıslıklı z sesi (peltek değildir); kendinden sonraya bitişmez.",
    exampleWordLocation: "99:1:2",
    exampleArabic: "زُلْزِلَتِ",
    exampleMeaningTr: "sarsıldığında",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/099_001_002.mp3",
  },
  {
    order: 12,
    isolated: "س",
    initial: "سـ",
    medial: "ـسـ",
    final: "ـس",
    nameTr: "Sîn",
    soundCategory: "ince",
    nonConnecting: false,
    makhrajTipTr: "İnce ve berrak s sesi; dil kabartılmaz.",
    exampleWordLocation: "114:1:4",
    exampleArabic: "ٱلنَّاسِ",
    exampleMeaningTr: "insanların",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/114_001_004.mp3",
  },
  {
    order: 13,
    isolated: "ش",
    initial: "شـ",
    medial: "ـشـ",
    final: "ـش",
    nameTr: "Şîn",
    soundCategory: "ince",
    nonConnecting: false,
    makhrajTipTr: "Dil ortasından ağız içine yayılan ş sesi.",
    exampleWordLocation: "113:2:2",
    exampleArabic: "شَرِّ",
    exampleMeaningTr: "şerrinden",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/113_002_002.mp3",
  },
  {
    order: 14,
    isolated: "ص",
    initial: "صـ",
    medial: "ـصـ",
    final: "ـص",
    nameTr: "Sâd (Kalın)",
    soundCategory: "kalın",
    nonConnecting: false,
    makhrajTipTr: "Dil kökü yukarı kalkar; kalın ve tok s sesi çıkar.",
    exampleWordLocation: "1:6:2",
    exampleArabic: "ٱلصِّرَٰطَ",
    exampleMeaningTr: "yola",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/001_006_002.mp3",
  },
  {
    order: 15,
    isolated: "ض",
    initial: "ضـ",
    medial: "ـضـ",
    final: "ـض",
    nameTr: "Dâd (Kalın)",
    soundCategory: "kalın",
    nonConnecting: false,
    makhrajTipTr: "Dil yanları üst azı dişlerine yaslanır; Arapçaya özgü kalın d sesi.",
    exampleWordLocation: "1:7:9",
    exampleArabic: "ٱلضَّآلِّينَ",
    exampleMeaningTr: "sapmışların",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/001_007_009.mp3",
  },
  {
    order: 16,
    isolated: "ط",
    initial: "طـ",
    medial: "ـطـ",
    final: "ـط",
    nameTr: "Tâ (Kalın)",
    soundCategory: "kalın",
    nonConnecting: false,
    makhrajTipTr: "Dil kökü kabartılarak çıkarılan tok ve kalın t sesi.",
    exampleWordLocation: "1:7:1",
    exampleArabic: "صِرَٰطَ",
    exampleMeaningTr: "yoluna",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/001_007_001.mp3",
  },
  {
    order: 17,
    isolated: "ظ",
    initial: "ظـ",
    medial: "ـظـ",
    final: "ـظ",
    nameTr: "Zâ (Kalın Peltek)",
    soundCategory: "kalın",
    nonConnecting: false,
    makhrajTipTr: "Dil ucu üst diş ucuna değdirilir, aynı anda dil kökü kalınlaştırılır.",
    exampleWordLocation: "78:2:3",
    exampleArabic: "ٱلْعَظِيمِ",
    exampleMeaningTr: "büyük (haber)",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/078_002_003.mp3",
  },
  {
    order: 18,
    isolated: "ع",
    initial: "عـ",
    medial: "ـعـ",
    final: "ـع",
    nameTr: "Ayn (Boğaz)",
    soundCategory: "boğaz",
    nonConnecting: false,
    makhrajTipTr: "Boğazın orta kısmını hafifçe sıkıştırarak çıkarılan derin ses.",
    exampleWordLocation: "1:5:2",
    exampleArabic: "نَعْبُدُ",
    exampleMeaningTr: "kulluk ederiz",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/001_005_002.mp3",
  },
  {
    order: 19,
    isolated: "غ",
    initial: "غـ",
    medial: "ـغـ",
    final: "ـغ",
    nameTr: "Gayn (Kalın)",
    soundCategory: "kalın",
    nonConnecting: false,
    makhrajTipTr: "Boğazın üstünden kalın g/ğ arası çıkan ses.",
    exampleWordLocation: "1:7:5",
    exampleArabic: "غَيْرِ",
    exampleMeaningTr: "değil (başkası)",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/001_007_005.mp3",
  },
  {
    order: 20,
    isolated: "ف",
    initial: "فـ",
    medial: "ـفـ",
    final: "ـف",
    nameTr: "Fê",
    soundCategory: "ince",
    nonConnecting: false,
    makhrajTipTr: "Üst ön dişlerin alt dudağın iç kısmına dokunmasıyla çıkan f sesi.",
    exampleWordLocation: "113:1:4",
    exampleArabic: "ٱلْفَلَقِ",
    exampleMeaningTr: "sabahın (felakın)",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/113_001_004.mp3",
  },
  {
    order: 21,
    isolated: "ق",
    initial: "قـ",
    medial: "ـقـ",
    final: "ـق",
    nameTr: "Kâf (Kalın)",
    soundCategory: "kalın",
    nonConnecting: false,
    makhrajTipTr: "Dil kökünün yumuşak damağa çarpmasıyla çıkan kalın k sesi.",
    exampleWordLocation: "113:1:1",
    exampleArabic: "قُلْ",
    exampleMeaningTr: "de ki",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/113_001_001.mp3",
  },
  {
    order: 22,
    isolated: "ك",
    initial: "كـ",
    medial: "ـكـ",
    final: "ـك",
    nameTr: "Kef",
    soundCategory: "ince",
    nonConnecting: false,
    makhrajTipTr: "Kâf'ın biraz daha önünden çıkan ince k sesi.",
    exampleWordLocation: "1:4:1",
    exampleArabic: "مَـٰلِكِ",
    exampleMeaningTr: "sahibi",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/001_004_001.mp3",
  },
  {
    order: 23,
    isolated: "ل",
    initial: "لـ",
    medial: "ـلـ",
    final: "ـل",
    nameTr: "Lâm",
    soundCategory: "ince",
    nonConnecting: false,
    makhrajTipTr: "Dil ucunun üst diş etine temasıyla çıkan ince l sesi.",
    exampleWordLocation: "1:2:2",
    exampleArabic: "لِلَّهِ",
    exampleMeaningTr: "Allah'a",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/001_002_002.mp3",
  },
  {
    order: 24,
    isolated: "م",
    initial: "مـ",
    medial: "ـمـ",
    final: "ـم",
    nameTr: "Mîm",
    soundCategory: "ince",
    nonConnecting: false,
    makhrajTipTr: "Dudakların kapanıp genizden hafif tını eşliğinde çıkan m sesi.",
    exampleWordLocation: "1:6:3",
    exampleArabic: "ٱلْمُسْتَقِيمَ",
    exampleMeaningTr: "doğru",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/001_006_003.mp3",
  },
  {
    order: 25,
    isolated: "ن",
    initial: "نـ",
    medial: "ـنـ",
    final: "ـن",
    nameTr: "Nûn",
    soundCategory: "ince",
    nonConnecting: false,
    makhrajTipTr: "Dil ucu üst diş etine dokunurken geniz tınısıyla çıkan n sesi.",
    exampleWordLocation: "1:5:4",
    exampleArabic: "نَسْتَعِينُ",
    exampleMeaningTr: "yardım isteriz",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/001_005_004.mp3",
  },
  {
    order: 26,
    isolated: "و",
    initial: "و",
    medial: "ـو",
    final: "ـو",
    nameTr: "Vâv",
    soundCategory: "ince",
    nonConnecting: true,
    makhrajTipTr: "Dudaklar yuvarlatılarak (dişler dudağa değmeden) okunur; sonrasına bitişmez.",
    exampleWordLocation: "1:4:2",
    exampleArabic: "يَوْمِ",
    exampleMeaningTr: "gününün",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/001_004_002.mp3",
  },
  {
    order: 27,
    isolated: "ه",
    initial: "هـ",
    medial: "ـهـ",
    final: "ـه",
    nameTr: "Hê",
    soundCategory: "boğaz",
    nonConnecting: false,
    makhrajTipTr: "Göğüs ve boğazın en dibinden rahatça çıkan yumuşak h sesi.",
    exampleWordLocation: "1:6:1",
    exampleArabic: "ٱهْدِنَا",
    exampleMeaningTr: "bizi ilet",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/001_006_001.mp3",
  },
  {
    order: 28,
    isolated: "ي",
    initial: "يـ",
    medial: "ـيـ",
    final: "ـي",
    nameTr: "Yâ",
    soundCategory: "ince",
    nonConnecting: false,
    makhrajTipTr: "Dil ortasından çıkan y sesi; harekesiz esre sonrası geldiğinde uzatır.",
    exampleWordLocation: "1:5:1",
    exampleArabic: "إِيَّاكَ",
    exampleMeaningTr: "ancak sana",
    exampleAudioUrl: "https://audio.qurancdn.com/wbw/001_005_001.mp3",
  },
];

export const ARABIC_READING_MODULES: ArabicLessonModule[] = [
  {
    id: "ar-letters-core",
    order: 1,
    category: "letters",
    titleTr: "Harfler ve Mahreç Yakınlığı (Benzer Harfleri Ayırt Etme)",
    subtitleTr: "İlk bakışta benzeyen harfleri nokta ve ses çıkış yerleriyle tanıma",
    explanationTr:
      "Yetişkin öğreniciler çoğu zaman harflerin tamamını unutmuş değildir; yalnızca şekli veya sesi yakın harfleri (ör. س / ص, ت / ط, د / ض, ذ / ز / ظ) karıştırır. Harfleri ince (terkîk) ve kalın (tefhîm) çiftler hâlinde ayırt etmek okumayı hızlandırır.",
    commonMistakeTr:
      "Türkçedeki tek bir 's' veya 'd' sesini hem ince (س, د) hem kalın (ص, ض) Arapça harfler için aynı şekilde okumak anlam farkına yol açabilir.",
    examples: [
      { arabic: "سَ / صَ", labelTr: "İnce Sîn — Kalın Sâd", noteTr: "Dil ucu alt kesici dişlerde; Sâd'da dil kökü yukarı kalkar." },
      { arabic: "ٱلصِّرَٰطَ", labelTr: "Fâtiha 1:6 örneği", noteTr: "Kalın ص (Sâd) ve kalın ط (Tâ) harfleri bir aradadır.", isQuranicRef: "1:6:2", audioUrl: "https://audio.qurancdn.com/wbw/001_006_002.mp3" },
      { arabic: "ٱلضَّآلِّينَ", labelTr: "Fâtiha 1:7 örneği", noteTr: "Kalın ض (Dâd) harfi Türkçedeki 'z' veya düz 'd' değildir.", isQuranicRef: "1:7:9", audioUrl: "https://audio.qurancdn.com/wbw/001_007_009.mp3" },
    ],
    miniCheck: {
      promptTr: "Fâtiha 1:6'daki «ٱلصِّرَٰطَ» kelimesinin ilk aslî harfi hangisidir?",
      arabicPrompt: "صِ",
      options: [
        { id: "a", labelTr: "س (İnce Sîn)", isCorrect: false },
        { id: "b", labelTr: "ص (Kalın Sâd)", isCorrect: true },
        { id: "c", labelTr: "ض (Kalın Dâd)", isCorrect: false },
      ],
    },
  },
  {
    id: "ar-letter-forms",
    order: 2,
    category: "forms",
    titleTr: "Harflerin Başta, Ortada ve Sonda Yazılışları",
    subtitleTr: "Bitişmeyen 6 harf (ا د ذ ر ز و) ve kelime içi dönüşümler",
    explanationTr:
      "Arapça sağdan sola bitişik yazılır. Harflerin çoğu kendinden önceki ve sonraki harfe bağlanır; ancak altı harf (ا، د، ذ، ر، ز، و) kendinden sonraki harfe bitişmez ve kelime içinde doğal bir boşluk bırakır.",
    commonMistakeTr:
      "Kelime içindeki bitişmeyen harften sonra gelen kısmı ayrı bir kelime sanmak (ör. مَـٰلِكِ veya صِرَٰطَ kelimelerinde ر sonrasında kopma olması).",
    examples: [
      { arabic: "عـ ـعـ ـع ع", labelTr: "Ayn (ع) harfinin 4 konumu", noteTr: "Başta açık, ortada ve sonda üçgenimsi kapalı göz şeklini alır." },
      { arabic: "نَعْبُدُ", labelTr: "Fâtiha 1:5 örneği", noteTr: "ن + ع + ب + د harflerinin bitişik akışı; د kendinden sonraya bitişmez.", isQuranicRef: "1:5:2", audioUrl: "https://audio.qurancdn.com/wbw/001_005_002.mp3" },
      { arabic: "عَلَيْهِمْ", labelTr: "Fâtiha 1:7 örneği", noteTr: "هـ harfinin ortadaki (ـهـ) ve م harfinin sondaki (ـم) biçimi.", isQuranicRef: "1:7:4", audioUrl: "https://audio.qurancdn.com/wbw/001_007_004.mp3" },
    ],
    miniCheck: {
      promptTr: "«نَعْبُدُ» kelimesinde ortada üçgen şeklinde görünen harf hangisidir?",
      arabicPrompt: "نَعْبُدُ",
      options: [
        { id: "a", labelTr: "غ (Gayn)", isCorrect: false },
        { id: "b", labelTr: "ع (Ayn)", isCorrect: true },
        { id: "c", labelTr: "ف (Fê)", isCorrect: false },
      ],
    },
  },
  {
    id: "ar-harakat",
    order: 3,
    category: "harakat",
    titleTr: "Harekeler: Üstün (Fetha), Esre (Kesra), Ötre (Damme)",
    subtitleTr: "Kısa sesli işaretleri uzatmadan net okuma",
    explanationTr:
      "Üstün (ـَ) ince harfleri 'e', kalın harfleri 'a' yönünde; Esre (ـِ) harfi aşağıdan 'i/ı' yönünde; Ötre (ـُ) dudakları öne toplayarak 'u/ü' yönünde okutur. Harekeler kısa seslidir, bir elif uzatılmaz.",
    commonMistakeTr:
      "Kısa harekeli heceleri sanki med harfi varmış gibi uzatarak okumak.",
    examples: [
      { arabic: "بَ بِ بُ", labelTr: "Eğitim hece örneği", noteTr: "Bê harfi üstün, esre ve ötre ile kısa okunur." },
      { arabic: "مَـٰلِكِ", labelTr: "Fâtiha 1:4 örneği", noteTr: "لِ esre ve كِ esre kısa okunur; yalnızca مَـٰ üzerinde dik elif uzatması vardır.", isQuranicRef: "1:4:1", audioUrl: "https://audio.qurancdn.com/wbw/001_004_001.mp3" },
      { arabic: "خَلَقَ", labelTr: "Alak 96:1 örneği", noteTr: "Üç harf de üstünlü ve kısadır (ha-le-ka).", isQuranicRef: "96:1:5", audioUrl: "https://audio.qurancdn.com/wbw/096_001_005.mp3" },
    ],
    miniCheck: {
      promptTr: "«بِسْمِ» kelimesindeki ilk harfin harekesi nedir?",
      arabicPrompt: "بِسْمِ",
      options: [
        { id: "a", labelTr: "Üstün (Fetha)", isCorrect: false },
        { id: "b", labelTr: "Esre (Kesra)", isCorrect: true },
        { id: "c", labelTr: "Ötre (Damme)", isCorrect: false },
      ],
    },
  },
  {
    id: "ar-sukun-shadda",
    order: 4,
    category: "sukun_shadda",
    titleTr: "Cezim (Sükûn) ve Şedde",
    subtitleTr: "Harfi durdurarak hece bağlama ve ikizleştirme",
    explanationTr:
      "Cezim (ـْ) üzerindeki harfin harekesiz olduğunu ve önceki harekeli harfle tek hece olarak birleştiğini gösterir (ör. بِسْ = bis). Şedde (ـّ) ise aynı harfin ilki cezimli, ikincisi harekeli iki kez okunduğunu bildirir (ör. رَبِّ = rab-bi).",
    commonMistakeTr:
      "Cezimli harfin yanına gizli bir 'ı/e' sesi eklemek (ör. 'el-hamdu' yerine 'el-hamıdu' demek) veya şeddeyi tek harf gibi geçmek.",
    examples: [
      { arabic: "ٱلْحَمْدُ", labelTr: "Fâtiha 1:2 örneği", noteTr: "لْ ve مْ üzerinde cezim vardır: el-ham-du.", isQuranicRef: "1:2:1", audioUrl: "https://audio.qurancdn.com/wbw/001_002_001.mp3" },
      { arabic: "إِيَّاكَ", labelTr: "Fâtiha 1:5 örneği", noteTr: "يَّ üzerinde şedde bulunur: iy-yâ-ke.", isQuranicRef: "1:5:1", audioUrl: "https://audio.qurancdn.com/wbw/001_005_001.mp3" },
      { arabic: "عَمَّ", labelTr: "Nebe 78:1 örneği", noteTr: "Şeddeli mîm iki hareke gunneli tutulur.", isQuranicRef: "78:1:1", audioUrl: "https://audio.qurancdn.com/wbw/078_001_001.mp3" },
    ],
    miniCheck: {
      promptTr: "«رَبِّ» kelimesindeki şedde nasıl okunur?",
      arabicPrompt: "رَبِّ",
      options: [
        { id: "a", labelTr: "B harfi tutulup iki kez bağlanır (rab-bi)", isCorrect: true },
        { id: "b", labelTr: "R harfi iki elif uzatılır", isCorrect: false },
        { id: "c", labelTr: "B harfi tamamen düşer", isCorrect: false },
      ],
    },
  },
  {
    id: "ar-tanween",
    order: 5,
    category: "tanween_madd",
    titleTr: "Tenvin: İki Üstün, İki Esre, İki Ötre",
    subtitleTr: "Kelime sonuna eklenen gizli nûn (-en, -in, -un) sesi",
    explanationTr:
      "Tenvin yalnızca isimlerin sonunda bulunur ve çift hareke ile yazılır: İki üstün (ـً) ince harfte '-en' kalın harfte '-an', iki esre (ـٍ) '-in/-ın', iki ötre (ـٌ) '-un/-ün' okutur. İki üstünden sonra genellikle okunmayan bir destek elifi yazılır (عَظِيمًا gibi).",
    commonMistakeTr:
      "İki üstünün yanındaki destek elifini uzatarak okumak veya ayet sonunda durulurken iki üstünü tenvinli bırakmak (durulurken tek üstün gibi bir elif uzatılır: medd-i ıvad).",
    examples: [
      { arabic: "أَحَدٌ", labelTr: "İhlâs 112:1 (İki ötre)", noteTr: "Son harf دٌ iki ötre ile 'ehadün' okunur; durulursa 'ehad' olur.", isQuranicRef: "112:1:4", audioUrl: "https://audio.qurancdn.com/wbw/112_001_004.mp3" },
      { arabic: "كُفُوًا", labelTr: "İhlâs 112:4 (İki üstün)", noteTr: "Sonunda destek elifi bulunur; geçişte 'küfüven' okunur.", isQuranicRef: "112:4:4", audioUrl: "https://audio.qurancdn.com/wbw/112_004_004.mp3" },
      { arabic: "بِقَدَرٍ", labelTr: "Eğitim örneği / İki esre", noteTr: "Çift esre kelime sonunda '-in/-ın' sesi verir." },
    ],
    miniCheck: {
      promptTr: "«أَحَدٌ» kelimesinin sonundaki işaret hangi sesliyi verir?",
      arabicPrompt: "أَحَدٌ",
      options: [
        { id: "a", labelTr: "İki ötre (tenvin: -ün)", isCorrect: true },
        { id: "b", labelTr: "Şeddeli ötre", isCorrect: false },
        { id: "c", labelTr: "Cezim (sükûn)", isCorrect: false },
      ],
    },
  },
  {
    id: "ar-tanween-madd",
    order: 6,
    category: "tanween_madd",
    titleTr: "Med Harfleri (ا و ي) ve Dik Elif (ـٰ)",
    subtitleTr: "Tabiî uzatmalar ve Medine Mushafı'ndaki küçük uzatma işaretleri",
    explanationTr:
      "Med harfleri olan elif (ا), vav (و) ve yâ (ي) harekesiz geldiklerinde önceki sesi iki hareke (bir elif miktarı) uzatır. Medine Mushafı'nda bazı kelimelerde uzatma küçük dik elif (ـٰ) ile gösterilir.",
    commonMistakeTr:
      "Mushaf'taki küçük dik elif (ـٰ) işaretini görmezden gelip «ٱلرَّحْمَـٰنِ» veya «ٱلْعَـٰلَمِينَ» kelimelerini kısa okumak.",
    examples: [
      { arabic: "ٱلْعَـٰلَمِينَ", labelTr: "Fâtiha 1:2 örneği", noteTr: "عَـٰ üzerinde dik elif ve مِي içinde med yâsı bulunur.", isQuranicRef: "1:2:4", audioUrl: "https://audio.qurancdn.com/wbw/001_002_004.mp3" },
      { arabic: "ٱلْمَغْضُوبِ", labelTr: "Fâtiha 1:7 örneği", noteTr: "ضُو içinde ötreyi uzatan med vavı vardır.", isQuranicRef: "1:7:6", audioUrl: "https://audio.qurancdn.com/wbw/001_007_006.mp3" },
      { arabic: "إِنَّآ", labelTr: "Kevser 108:1 örneği", noteTr: "نَّ içinde elif ile tabiî uzatma (ve geçişte medd-i munfasıl) vardır.", isQuranicRef: "108:1:1", audioUrl: "https://audio.qurancdn.com/wbw/108_001_001.mp3" },
    ],
    miniCheck: {
      promptTr: "«ٱلرَّحْمَـٰنِ» kelimesindeki küçük dik elif (ـٰ) ne işe yarar?",
      arabicPrompt: "ٱلرَّحْمَـٰنِ",
      options: [
        { id: "a", labelTr: "Durak işaretidir", isCorrect: false },
        { id: "b", labelTr: "Mîm harfinin sesini bir elif miktarı uzatır", isCorrect: true },
        { id: "c", labelTr: "Harfin okunmayacağını gösterir", isCorrect: false },
      ],
    },
  },
  {
    id: "ar-connected-wasl",
    order: 7,
    category: "connected_reading",
    titleTr: "Hemze, Hemze-i Vasıl (ٱ) ve Şemsî-Kamerî Lâm",
    subtitleTr: "Kelime geçişlerinde düşen ve başlangıçta okunan elifler",
    explanationTr:
      "Üzerinde küçük sâd başı bulunan elif (ٱ) Hemze-i Vasıl'dır. Cümle başında uygun hareke ile okunur; önceki kelimeden geçerken ses düşer ve doğrudan sonraki okunan harfe bağlanır. Şemsî harflerden önce gelen ال takısındaki lâm okunmaz, sonraki harf şeddelenir (ör. ٱلرَّحِيمِ).",
    commonMistakeTr:
      "«بِسْمِ ٱللَّهِ» veya «رَبِّ ٱلْعَـٰلَمِينَ» okurken aradaki hemze-i vasıl'ı yeniden 'e/i' diye kesintili okumak.",
    examples: [
      { arabic: "رَبِّ ٱلْعَـٰلَمِينَ", labelTr: "Kamerî Lâm geçişi", noteTr: "بِّ sesi doğrudan لْ harfine bağlanır: rabbil-'âlemîn.", isQuranicRef: "1:2:3", audioUrl: "https://audio.qurancdn.com/wbw/001_002_003.mp3" },
      { arabic: "يَوْمِ ٱلدِّينِ", labelTr: "Şemsî Lâm geçişi", noteTr: "ل yazılır ama okunmaz; مِ doğrudan şeddeli دِّ harfine bağlanır.", isQuranicRef: "1:4:2", audioUrl: "https://audio.qurancdn.com/wbw/001_004_002.mp3" },
      { arabic: "وَٱلْعَصْرِ", labelTr: "Asr 103:1 örneği", noteTr: "وَ doğrudan لْ harfine bağlanır: vel-'asr.", isQuranicRef: "103:1:1", audioUrl: "https://audio.qurancdn.com/wbw/103_001_001.mp3" },
    ],
    miniCheck: {
      promptTr: "«يَوْمِ ٱلدِّينِ» ifadesi birleştirilerek okunurken aradaki «ٱل» nasıl okunur?",
      arabicPrompt: "يَوْمِ ٱلدِّينِ",
      options: [
        { id: "a", labelTr: "Hem hemze hem lâm açıkça okunur (yevmi el-dîn)", isCorrect: false },
        { id: "b", labelTr: "İkisi de geçilir ve د şeddeli okunur (yevmid-dîn)", isCorrect: true },
        { id: "c", labelTr: "Yalnızca lâm okunur (yevmil-dîn)", isCorrect: false },
      ],
    },
  },
  {
    id: "ar-fluency-drills",
    order: 8,
    category: "connected_reading",
    titleTr: "Bitişik Okuma ve Namaz Sureleriyle Akıcılık",
    subtitleTr: "Kısa ayetlerde hece bölmeyi bırakıp kelime bütünlüğüyle okuma",
    explanationTr:
      "Harf, hareke, cezim, şedde ve hemze-i vasıl birleştiğinde artık kısa sureleri akıcı şekilde okuyabilirsiniz. Okurken gözünüzü bir sonraki kelimenin başındaki hemze-i vasıl veya şeddeye kaydırarak nefes ve bağlantı akışını koruyun.",
    commonMistakeTr:
      "Her kelimeyi ayrı duraklayarak okuyup geçişlerdeki şedde ve vasıl bağlantılarını koparmak.",
    examples: [
      { arabic: "قُلْ هُوَ ٱللَّهُ أَحَدٌ", labelTr: "İhlâs 112:1", noteTr: "Cezimli لْ + kalınlaşan Lafzatullah + kısa hemzeli أَحَدٌ.", isQuranicRef: "112:1:1", audioUrl: "https://audio.qurancdn.com/wbw/112_001_001.mp3" },
      { arabic: "إِنَّآ أَعْطَيْنَـٰكَ ٱلْكَوْثَرَ", labelTr: "Kevser 108:1", noteTr: "Gunneli şedde + medd-i munfasıl + dik elif + kamerî lâm.", isQuranicRef: "108:1:2", audioUrl: "https://audio.qurancdn.com/wbw/108_001_002.mp3" },
    ],
    miniCheck: {
      promptTr: "«قُلْ هُوَ ٱللَّهُ» okunurken هُوَ kelimesinin sonundaki üstünden sonra Lafzatullah nasıl okunur?",
      arabicPrompt: "هُوَ ٱللَّهُ",
      options: [
        { id: "a", labelTr: "Hemze-i vasıl düşer, üstün sebebiyle Lafzatullah kalın okunur (huvallâhu)", isCorrect: true },
        { id: "b", labelTr: "Duraklanıp 'huve ellâh' diye ayrılır", isCorrect: false },
        { id: "c", labelTr: "Lafzatullah ince okunur", isCorrect: false },
      ],
    },
  },
];

export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  {
    id: "pq-1",
    category: "letters",
    promptTr: "Bu harfin adı nedir?",
    arabicSample: "ض",
    options: [
      { id: "a", label: "Sâd (ص)", isCorrect: false },
      { id: "b", label: "Dâd (ض)", isCorrect: true },
      { id: "c", label: "Zâ (ظ)", isCorrect: false },
    ],
    explanationTr: "Üzerinde tek nokta bulunan kalın harf Dâd (ض) harfidir.",
  },
  {
    id: "pq-2",
    category: "forms",
    promptTr: "Ortada yer alan bu birleşik biçim hangi harfe aittir?",
    arabicSample: "ـهـ",
    options: [
      { id: "a", label: "Hê (ه)", isCorrect: true },
      { id: "b", label: "Mîm (م)", isCorrect: false },
      { id: "c", label: "Tê (ت)", isCorrect: false },
    ],
    explanationTr: "Çift gözlü orta biçim (ـهـ) Hê harfine aittir; örnek: عَلَيْهِمْ.",
  },
  {
    id: "pq-3",
    category: "harakat",
    promptTr: "Bu hecenin doğru seslendirilişi hangisidir?",
    arabicSample: "كُ",
    options: [
      { id: "a", label: "ke", isCorrect: false },
      { id: "b", label: "ki", isCorrect: false },
      { id: "c", label: "ku", isCorrect: true },
    ],
    explanationTr: "Harfin üzerindeki ötre (damme) kısa 'u' sesi verir.",
  },
  {
    id: "pq-4",
    category: "sukun_shadda",
    promptTr: "Bu kelimede hangi harfin üzerinde şedde vardır?",
    arabicSample: "إِيَّاكَ",
    options: [
      { id: "a", label: "Hemze (إ)", isCorrect: false },
      { id: "b", label: "Yâ (ي)", isCorrect: true },
      { id: "c", label: "Kef (ك)", isCorrect: false },
    ],
    explanationTr: "Şedde (ـّ) işareti ortadaki ي harfinin üzerindedir (iy-yâ-ke).",
  },
  {
    id: "pq-5",
    category: "tanween_madd",
    promptTr: "Bu kelimede kaç yerde uzatma (med) vardır?",
    arabicSample: "ٱلْعَـٰلَمِينَ",
    options: [
      { id: "a", label: "1 yerde", isCorrect: false },
      { id: "b", label: "2 yerde (عَـٰ ve مِي)", isCorrect: true },
      { id: "c", label: "Hiç yoktur", isCorrect: false },
    ],
    explanationTr: "İlk uzatma ع üzerindeki dik elif (ـٰ), ikinci uzatma مِي içindeki med yâsıdır.",
  },
  {
    id: "pq-6",
    category: "connected_reading",
    promptTr: "Bu iki kelimenin bitişik doğru okunuşu hangisidir?",
    arabicSample: "مَـٰلِكِ يَوْمِ ٱلدِّينِ",
    options: [
      { id: "a", label: "mâliki yevmid-dîni", isCorrect: true },
      { id: "b", label: "malik yevmi el-dîni", isCorrect: false },
      { id: "c", label: "melîki yevmil-dîni", isCorrect: false },
    ],
    explanationTr: "Hemze-i vasıl ve şemsî lâm geçişte okunmaz; د harfi şeddeyle bağlanır.",
  },
];

export const TAJWEED_LESSONS: TajweedLesson[] = [
  {
    slug: "makharij-and-sifat",
    order: 1,
    nameTr: "Mahâricü'l-Hurûf ve Sıfât (Kalınlık ve İncelik)",
    nameArabic: "مخارج الحروف وصفاتها",
    categoryTr: "Mahreç ve Sıfat",
    difficulty: 1,
    summaryTr:
      "Her harfin ağız ve boğazda çıktığı nokta (mahreç) ve taşıdığı kalınlık/incelik/hışırtı niteliği (sıfat) vardır. İstîlâ harfleri (خ ص ض غ ط ق ظ) her harekeyle kalın okunur.",
    fatihaExample: {
      verseKey: "1:6",
      wordLocation: "1:6:2",
      arabic: "ٱلصِّرَٰطَ",
      explanationTr:
        "Sâd (ص) ve Tâ (ط) kalın harflerdir; aynı kelimede kalınlığa dikkat edilerek 'sırâta' şeklinde okunur.",
      audioUrl: "https://audio.qurancdn.com/wbw/001_006_002.mp3",
    },
    listenDiscriminationTipTr:
      "Kelimeyi dinlerken ilk hecedeki ص sesinin ince 'si' değil tok 'sı' yönünde tınladığını fark edin.",
  },
  {
    slug: "madd-tabii-arizi-lazim",
    order: 2,
    nameTr: "Med Çeşitleri (Tabiî Med, Ârız Med ve Medd-i Lâzım)",
    nameArabic: "أحكام المدّ",
    categoryTr: "Uzatmalar",
    difficulty: 1,
    summaryTr:
      "Fâtiha 1:1'deki «ٱلرَّحِيمِ» sonunda vakıf yapıldığında Medd-i Ârız (2–4–6 hareke), 1:7'deki «ٱلضَّآلِّينَ» kelimesinde ise şedde sebebiyle 6 hareke uzatılan Medd-i Lâzım Kelime-i Musakkale bulunur.",
    fatihaExample: {
      verseKey: "1:7",
      wordLocation: "1:7:9",
      arabic: "ٱلضَّآلِّينَ",
      explanationTr:
        "Med harfi eliften (ا) sonra şeddeli lâm (لّ) geldiği için 6 hareke uzatılır ve şeddeli lâm tutulur.",
      audioUrl: "https://audio.qurancdn.com/wbw/001_007_009.mp3",
    },
    listenDiscriminationTipTr:
      "Referans kayıtta 1:7'nin son kelimesini dinleyin: uzun meddin ardından 'l' sesinin netçe çift tutulduğunu duyacaksınız.",
  },
  {
    slug: "ghunnah-rules",
    order: 3,
    nameTr: "Gunne (Şeddeli Nûn ve Şeddeli Mîm)",
    nameArabic: "أحكام الغنّة",
    categoryTr: "Geniz Sesi",
    difficulty: 1,
    summaryTr:
      "Üzerinde şedde bulunan نّ ve مّ harflerinde ses yaklaşık 2 hareke (1 elif miktarı) genizde tutularak akıtılır.",
    fatihaExample: {
      verseKey: "78:1",
      wordLocation: "78:1:1",
      arabic: "عَمَّ",
      explanationTr:
        "Nebe Suresi'nin ilk kelimesi «عَمَّ» içindeki şeddeli mîm gunne ile tutularak okunur.",
      audioUrl: "https://audio.qurancdn.com/wbw/078_001_001.mp3",
    },
    listenDiscriminationTipTr:
      "Nâs Suresi'ndeki «ٱلنَّاسِ» ve Nebe 1'deki «عَمَّ» kelimelerinde sesin burundan titreşerek nasıl beklediğini dinleyin.",
  },
  {
    slug: "qalqalah-rules",
    order: 4,
    nameTr: "Kalkale (ق ط ب ج د Harflerinde Vurgulu Yankı)",
    nameArabic: "أحكام القلقلة",
    categoryTr: "Harf Vurgusu",
    difficulty: 2,
    summaryTr:
      "Kutb-u Ced (ق ط ب ج د) harfleri kelime ortasında cezimli geldiğinde veya ayet sonunda durularak cezimli hâle geçtiğinde mahreçten hafifçe sekerek (yankılanarak) okunur.",
    fatihaExample: {
      verseKey: "112:3",
      wordLocation: "112:3:2",
      arabic: "يَلِدْ",
      explanationTr:
        "İhlâs 112:3'teki «يَلِدْ» kelimesinde cezimli د harfi kalkale ile okunur; sonuna 'i/ı' sesi eklenmeden net sekme yapılır.",
      audioUrl: "https://audio.qurancdn.com/wbw/112_003_002.mp3",
    },
    listenDiscriminationTipTr:
      "İhlâs Suresi'nin 1–4. ayet sonlarında (أَحَدْ، ٱلصَّمَدْ، يُولَدْ، أَحَدْ) son harfin nasıl yankılı durduğunu dinleyin.",
  },
  {
    slug: "noon-sakinah-tanween",
    order: 5,
    nameTr: "Sâkin Nûn ve Tenvîn Kuralları (İzhâr, İdğâm, İklâb, İhfâ)",
    nameArabic: "أحكام النون الساكنة والتنوين",
    categoryTr: "Sâkin Nûn",
    difficulty: 3,
    summaryTr:
      "Cezimli nûn (نْ) veya tenvînden sonra gelen harfe göre dört durum oluşur: Boğaz harfleri gelirse açık okuma (İzhâr), ي ر م ل و ن gelirse katma (İdğâm), ب gelirse mîme çevirme (İklâb), diğer 15 harfte ise gizleme (İhfâ).",
    fatihaExample: {
      verseKey: "113:2",
      wordLocation: "113:2:1",
      arabic: "مِن شَرِّ",
      explanationTr:
        "Felak 113:2'de «مِنْ» sonundaki sâkin nûn'dan sonra ش geldiği için İhfâ yapılır (dil nûn mahrecine tam değmeden genizden gizlenir).",
      audioUrl: "https://audio.qurancdn.com/wbw/113_002_001.mp3",
    },
    listenDiscriminationTipTr:
      "«مِن شَرِّ» ile «كُفُوًا أَحَدٌ» (İzhâr) arasındaki nûn sesinin açıklık farkını karşılaştırın.",
  },
  {
    slug: "meem-sakinah-rules",
    order: 6,
    nameTr: "Sâkin Mîm Kuralları",
    nameArabic: "أحكام الميم الساكنة",
    categoryTr: "Sâkin Mîm",
    difficulty: 2,
    summaryTr:
      "Cezimli mîmden (مْ) sonra ب gelirse İhfâ-i Şefevî, yine م gelirse İdğâm-ı Misleyn Maal-Gunne, diğer harfler gelirse dudaklar kapanarak açık İzhâr-ı Şefevî uygulanır.",
    fatihaExample: {
      verseKey: "1:7",
      wordLocation: "1:7:4",
      arabic: "عَلَيْهِمْ",
      explanationTr:
        "Fâtiha 1:7'de «عَلَيْهِمْ غَيْرِ» geçişinde مْ sonrasında غ geldiği için İzhâr-ı Şefevî yapılır; mîm uzatılmadan net kapatılır.",
      audioUrl: "https://audio.qurancdn.com/wbw/001_007_004.mp3",
    },
    listenDiscriminationTipTr:
      "Fîl 105:4'teki «تَرْمِيهِم بِحِجَارَةٍۢ» geçişinde gunneli yumuşamayı, Fâtiha 1:7'deki net mîm kapanışıyla kıyaslayın.",
  },
  {
    slug: "shamsi-qamari-and-lafzatullah",
    order: 7,
    nameTr: "Lâm-ı Ta'rîf ve Lafzatullah'ın Kalınlık/İnceliği",
    nameArabic: "اللام القمرية والشمسية ولفظ الجلالة",
    categoryTr: "Harf Birleşimleri",
    difficulty: 1,
    summaryTr:
      "«ٱل» takısı kamerî harfte açık (ٱلْحَمْدُ), şemsî harfte katılarak (ٱلرَّحْمَـٰنِ) okunur. «ٱللَّه» lafzı öncesi üstün/ötreyse kalın (قُلْ هُوَ ٱللَّهُ), esreyse ince (بِسْمِ ٱللَّهِ) okunur.",
    fatihaExample: {
      verseKey: "1:1",
      wordLocation: "1:1:2",
      arabic: "بِسْمِ ٱللَّهِ",
      explanationTr: "Önceki مِ harfi esreli olduğu için Lafzatullah ince (terkîk) okunur.",
      audioUrl: "https://audio.qurancdn.com/wbw/001_001_002.mp3",
    },
    listenDiscriminationTipTr:
      "Fâtiha 1:1 («بِسْمِ ٱللَّهِ» ince) ile İhlâs 112:1 («هُوَ ٱللَّهُ» kalın) arasındaki 'l' tınısını yan yana dinleyin.",
  },
  {
    slug: "waqf-ibtida-basics",
    order: 8,
    nameTr: "Vakf ve İbtidâ (Duruş ve Başlayış)",
    nameArabic: "الوقف والابتداء",
    categoryTr: "Duruş Kuralları",
    difficulty: 2,
    summaryTr:
      "Ayet sonlarında durulduğunda son hareke okunmaz, harf sükûnla durdurulur. Yalnızca iki üstünlü kelimede durulurken tek üstün gibi bir elif uzatılır (Medd-i Ivad); yuvarlak tê (ة) ise duruşta 'h' sesine dönüşür.",
    fatihaExample: {
      verseKey: "1:5",
      wordLocation: "1:5:4",
      arabic: "نَسْتَعِينُ",
      explanationTr: "Ayet sonunda durulurken son ötre bırakılır ve nûn sükûnla (nesta‘în) okunur.",
      audioUrl: "https://audio.qurancdn.com/wbw/001_005_004.mp3",
    },
    listenDiscriminationTipTr:
      "Husarî (Muallim) kaydında her ayet sonunda harekenin nasıl sükûna dönüştüğünü dinleyin.",
  },
];
