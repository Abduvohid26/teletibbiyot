export type PdfLocale = 'uz' | 'ru' | 'en';

export type PdfLabels = {
  title: string;
  subtitle: string;
  datePrefix: string;
  sectionPatientInfo: string;
  patient: string;
  age: string;
  years: string;
  gender: string;
  male: string;
  female: string;
  objective: string;
  weight: string;
  height: string;
  bmi: string;
  bp: string;
  pulse: string;
  temperature: string;
  spo2: string;
  respiratory: string;
  complaints: string;
  lab: string;
  labDefault: string;
  anamnesis: string;
  medications: string;
  facility: string;
  doctor: string;
  consensusTitle: string;
  sectionDiagnoses: string;
  icd10: string;
  justification: string;
  logicChain: string;
  sectionAlternative: string;
  sectionArticles: string;
  sectionTreatment: string;
  step: string;
  sectionMedications: string;
  pharmacologyWarnings: string;
  dose: string;
  tradeNames: string;
  sectionNextSteps: string;
  additionalTests: string;
  routing: string;
  specialists: string;
  followUp: string;
  sectionRiskFactors: string;
  severity: string;
  assessed: string;
  sectionPrognosis: string;
  shortTerm: string;
  longTerm: string;
  sectionDiet: string;
  allowed: string;
  restricted: string;
  prevention: string;
  sectionHerbal: string;
  herbalDisclaimer: string;
  preparation: string;
  caution: string;
  sectionQuality: string;
  overallScore: string;
  sectionRecorded: string;
  sectionRejected: string;
  sectionRedFlags: string;
  footer: string;
  page: string;
  dash: string;
  bpm: string;
  celsius: string;
  percent: string;
  perMin: string;
  mmHg: string;
  kg: string;
  cm: string;
};

const UZ: PdfLabels = {
  title: 'KONSILIUM: Yakuniy Klinik Xulosa',
  subtitle: "Rasmiy tibbiy maslahat hujjati — doktor tavsiyasi sifatida. Faqat ma'lumot uchun.",
  datePrefix: 'Sana:',
  sectionPatientInfo: "Bemor ma'lumotlari",
  patient: 'Bemor:',
  age: 'Yoshi:',
  years: 'yosh',
  gender: 'Jinsi:',
  male: 'Erkak',
  female: 'Ayol',
  objective: "Ob'ektiv:",
  weight: 'Tana vazni',
  height: "Bo'y",
  bmi: 'Tana massasi indeksi (TMI)',
  bp: 'Arterial bosim',
  pulse: 'Yurak urishi (Puls)',
  temperature: 'Tana harorati',
  spo2: 'Saturatsiya (SpO2)',
  respiratory: 'Nafas soni',
  complaints: 'Shikoyat:',
  lab: 'Laboratoriya:',
  labDefault: 'Laboratoriya va diagnostika natijalari fayl sifatida yuklandi.',
  anamnesis: 'Kasallik tarixi:',
  medications: 'Dorilar:',
  facility: 'UT muassasa:',
  doctor: 'Shifokor:',
  consensusTitle: 'Konsilium Konsensusi',
  sectionDiagnoses: 'Tashxislar',
  icd10: 'MKB-10:',
  justification: 'Asoslash:',
  logicChain: 'Mantiqiy zanjir:',
  sectionAlternative: 'Muqobil tashxis',
  sectionArticles: 'Tegishli ilmiy maqolalar',
  sectionTreatment: 'Davolash Rejasi',
  step: 'qadam:',
  sectionMedications: 'Dori Tavsiyalari',
  pharmacologyWarnings: 'Farmakolog ogohlantirishlari:',
  dose: 'Doza:',
  tradeNames: 'Mahalliy nomlar:',
  sectionNextSteps: 'Keyingi qadamlar rejasi',
  additionalTests: "Qo'shimcha tekshiruvlar:",
  routing: "Yo'nalish:",
  specialists: 'Tavsiya etilgan mutaxassislar:',
  followUp: 'Keyingi kuzatuv:',
  sectionRiskFactors: 'Xavf omillari',
  severity: "Holat og'irligi:",
  assessed: 'Baholangan',
  sectionPrognosis: 'Kasallik prognozi',
  shortTerm: 'Qisqa muddat (1–3 oy):',
  longTerm: 'Uzoq muddat (1–5 yil):',
  sectionDiet: "To'g'ri ovqatlanish va kasalliklarni oldini olish (profilaktika)",
  allowed: 'Ruxsat:',
  restricted: 'Cheklangan:',
  prevention: 'Profilaktika:',
  sectionHerbal: "Xalq tabobati va dorivor o'simliklar (qo'shimcha)",
  herbalDisclaimer: "Rasmiy dori va shifokor ko'rsatmasining o'rnini bosmaydi.",
  preparation: 'Tayyorlash:',
  caution: 'Ehtiyot:',
  sectionQuality: 'Tibbiy yordam sifati (protokol asosida)',
  overallScore: 'Umumiy ball:',
  sectionRecorded: "Kartada qayd etilgan ma'lumotlar",
  sectionRejected: 'Rad Etilgan Gipotezalar',
  sectionRedFlags: 'Qizil bayroqlar',
  footer: 'Raqamli tizim yordamida shakllantirilgan. Faqat ma\'lumot uchun.',
  page: 'Sahifa',
  dash: '—',
  bpm: 'bpm',
  celsius: '°C',
  percent: '%',
  perMin: '/min',
  mmHg: 'mmHg',
  kg: 'kg',
  cm: 'sm',
};

const RU: PdfLabels = {
  title: 'КОНСИЛИУМ: Итоговое клиническое заключение',
  subtitle: 'Официальный медицинский документ — рекомендация врача. Только для информации.',
  datePrefix: 'Дата:',
  sectionPatientInfo: 'Данные пациента',
  patient: 'Пациент:',
  age: 'Возраст:',
  years: 'лет',
  gender: 'Пол:',
  male: 'Мужской',
  female: 'Женский',
  objective: 'Объективно:',
  weight: 'Масса тела',
  height: 'Рост',
  bmi: 'Индекс массы тела (ИМТ)',
  bp: 'Артериальное давление',
  pulse: 'Пульс',
  temperature: 'Температура тела',
  spo2: 'Сатурация (SpO₂)',
  respiratory: 'Частота дыхания',
  complaints: 'Жалобы:',
  lab: 'Лаборатория:',
  labDefault: 'Результаты лабораторных и диагностических исследований загружены в виде файла.',
  anamnesis: 'Анамнез заболевания:',
  medications: 'Препараты:',
  facility: 'УЗ учреждение:',
  doctor: 'Врач:',
  consensusTitle: 'Консенсус консилиума',
  sectionDiagnoses: 'Диагнозы',
  icd10: 'МКБ-10:',
  justification: 'Обоснование:',
  logicChain: 'Логическая цепочка:',
  sectionAlternative: 'Альтернативный диагноз',
  sectionArticles: 'Соответствующие научные статьи',
  sectionTreatment: 'План лечения',
  step: 'шаг:',
  sectionMedications: 'Рекомендации по препаратам',
  pharmacologyWarnings: 'Фармакологические предупреждения:',
  dose: 'Доза:',
  tradeNames: 'Торговые названия:',
  sectionNextSteps: 'План дальнейших действий',
  additionalTests: 'Дополнительные обследования:',
  routing: 'Маршрутизация:',
  specialists: 'Рекомендованные специалисты:',
  followUp: 'Последующее наблюдение:',
  sectionRiskFactors: 'Факторы риска',
  severity: 'Тяжесть состояния:',
  assessed: 'Оценено',
  sectionPrognosis: 'Прогноз заболевания',
  shortTerm: 'Краткосрочный (1–3 мес.):',
  longTerm: 'Долгосрочный (1–5 лет):',
  sectionDiet: 'Правильное питание и профилактика',
  allowed: 'Разрешено:',
  restricted: 'Ограничено:',
  prevention: 'Профилактика:',
  sectionHerbal: 'Народная медицина и лекарственные растения (дополнительно)',
  herbalDisclaimer: 'Не заменяет официальные препараты и назначения врача.',
  preparation: 'Приготовление:',
  caution: 'Осторожно:',
  sectionQuality: 'Качество медицинской помощи (по протоколу)',
  overallScore: 'Общий балл:',
  sectionRecorded: 'Записанные в карте данные',
  sectionRejected: 'Отклонённые гипотезы',
  sectionRedFlags: 'Красные флаги',
  footer: 'Сформировано с помощью цифровой системы. Только для информации.',
  page: 'Страница',
  dash: '—',
  bpm: 'уд/мин',
  celsius: '°C',
  percent: '%',
  perMin: '/мин',
  mmHg: 'мм рт. ст.',
  kg: 'кг',
  cm: 'см',
};

const EN: PdfLabels = {
  title: 'CONSULTATION: Final Clinical Conclusion',
  subtitle: 'Official medical advisory document — doctor recommendation. For information only.',
  datePrefix: 'Date:',
  sectionPatientInfo: 'Patient information',
  patient: 'Patient:',
  age: 'Age:',
  years: 'years',
  gender: 'Gender:',
  male: 'Male',
  female: 'Female',
  objective: 'Objective:',
  weight: 'Body weight',
  height: 'Height',
  bmi: 'Body mass index (BMI)',
  bp: 'Blood pressure',
  pulse: 'Heart rate (Pulse)',
  temperature: 'Body temperature',
  spo2: 'Oxygen saturation (SpO₂)',
  respiratory: 'Respiratory rate',
  complaints: 'Chief complaint:',
  lab: 'Laboratory:',
  labDefault: 'Laboratory and diagnostic results were uploaded as a file.',
  anamnesis: 'History of present illness:',
  medications: 'Medications:',
  facility: 'Primary care facility:',
  doctor: 'Physician:',
  consensusTitle: 'Consultation consensus',
  sectionDiagnoses: 'Diagnoses',
  icd10: 'ICD-10:',
  justification: 'Rationale:',
  logicChain: 'Logic chain:',
  sectionAlternative: 'Alternative diagnosis',
  sectionArticles: 'Relevant scientific articles',
  sectionTreatment: 'Treatment plan',
  step: 'step:',
  sectionMedications: 'Medication recommendations',
  pharmacologyWarnings: 'Pharmacology warnings:',
  dose: 'Dose:',
  tradeNames: 'Trade names:',
  sectionNextSteps: 'Next steps plan',
  additionalTests: 'Additional tests:',
  routing: 'Routing:',
  specialists: 'Recommended specialists:',
  followUp: 'Follow-up:',
  sectionRiskFactors: 'Risk factors',
  severity: 'Condition severity:',
  assessed: 'Assessed',
  sectionPrognosis: 'Disease prognosis',
  shortTerm: 'Short term (1–3 months):',
  longTerm: 'Long term (1–5 years):',
  sectionDiet: 'Nutrition and disease prevention',
  allowed: 'Allowed:',
  restricted: 'Restricted:',
  prevention: 'Prevention:',
  sectionHerbal: 'Traditional medicine and herbal remedies (supplementary)',
  herbalDisclaimer: 'Does not replace official medication and physician instructions.',
  preparation: 'Preparation:',
  caution: 'Caution:',
  sectionQuality: 'Quality of care (protocol-based)',
  overallScore: 'Overall score:',
  sectionRecorded: 'Recorded chart findings',
  sectionRejected: 'Rejected hypotheses',
  sectionRedFlags: 'Red flags',
  footer: 'Generated with digital system assistance. For information only.',
  page: 'Page',
  dash: '—',
  bpm: 'bpm',
  celsius: '°C',
  percent: '%',
  perMin: '/min',
  mmHg: 'mmHg',
  kg: 'kg',
  cm: 'cm',
};

const LABELS: Record<PdfLocale, PdfLabels> = { uz: UZ, ru: RU, en: EN };

const DATE_LOCALE: Record<PdfLocale, string> = {
  uz: 'uz-UZ',
  ru: 'ru-RU',
  en: 'en-GB',
};

export function normalizePdfLocale(value: unknown): PdfLocale {
  if (value === 'ru' || value === 'en' || value === 'uz') return value;
  if (typeof value === 'string') {
    const base = value.toLowerCase().split('-')[0];
    if (base === 'ru' || base === 'en' || base === 'uz') return base;
  }
  return 'uz';
}

export function getPdfLabels(locale: PdfLocale): PdfLabels {
  return LABELS[locale];
}

export function formatPdfDate(locale: PdfLocale, date = new Date()): string {
  return date.toLocaleDateString(DATE_LOCALE[locale]);
}
