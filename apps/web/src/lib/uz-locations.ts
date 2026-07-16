/** O'zbekiston viloyatlari va tumanlari (qidiruvli select uchun) */

export interface UzRegion {
  name: string;
  districts: string[];
}

export const UZ_REGIONS: UzRegion[] = [
  {
    name: "Andijon viloyati",
    districts: [
      'Andijon shahri', 'Asaka tumani', 'Baliqchi tumani', 'Bo\'ston tumani', 'Buloqboshi tumani',
      'Izboskan tumani', 'Jalaquduq tumani', 'Marhamat tumani', 'Oltinko\'l tumani', 'Paxtaobod tumani',
      'Qo\'rg\'ontepa tumani', 'Shahrixon tumani', 'Ulug\'nor tumani', 'Xo\'jaobod tumani',
    ],
  },
  {
    name: "Buxoro viloyati",
    districts: [
      'Buxoro shahri', 'G\'ijduvon tumani', 'Jondor tumani', 'Kogon tumani', 'Olot tumani',
      'Peshku tumani', 'Qorako\'l tumani', 'Qorovulbozor tumani', 'Romitan tumani', 'Shofirkon tumani',
      'Vobkent tumani',
    ],
  },
  {
    name: "Farg'ona viloyati",
    districts: [
      'Farg\'ona shahri', 'Bag\'dod tumani', 'Beshariq tumani', 'Buvayda tumani', 'Dang\'ara tumani',
      'Farg\'ona tumani', 'Furqat tumani', 'Qo\'qon shahri', 'Qo\'shtepa tumani', 'Marg\'ilon shahri',
      'O\'zbekiston tumani', 'Quva tumani', 'Rishton tumani', 'So\'x tumani', 'Toshloq tumani',
      'Uchko\'prik tumani', 'Yozyovon tumani',
    ],
  },
  {
    name: "Jizzax viloyati",
    districts: [
      'Jizzax shahri', 'Arnasoy tumani', 'Baxmal tumani', 'Do\'stlik tumani', 'Forish tumani',
      'G\'allaorol tumani', 'Mirzacho\'l tumani', 'Paxtakor tumani', 'Yangiobod tumani', 'Zafarobod tumani',
      'Zarbdor tumani', 'Zomin tumani',
    ],
  },
  {
    name: "Qashqadaryo viloyati",
    districts: [
      'Qarshi shahri', 'Chiroqchi tumani', 'Dehqonobod tumani', 'G\'uzor tumani', 'Kasbi tumani',
      'Kitob tumani', 'Koson tumani', 'Mirishkor tumani', 'Muborak tumani', 'Nishon tumani',
      'Qamashi tumani', 'Qarshi tumani', 'Shahrisabz tumani', 'Yakkabog\' tumani',
    ],
  },
  {
    name: "Navoiy viloyati",
    districts: [
      'Navoiy shahri', 'Konimex tumani', 'Karmana tumani', 'Nurota tumani', 'Qiziltepa tumani',
      'Tomdi tumani', 'Uchquduq tumani', 'Xatirchi tumani', 'Zarafshon shahri',
    ],
  },
  {
    name: "Namangan viloyati",
    districts: [
      'Namangan shahri', 'Chortoq tumani', 'Chust tumani', 'Kosonsoy tumani', 'Mingbuloq tumani',
      'Namangan tumani', 'Norin tumani', 'Pop tumani', 'To\'raqo\'rg\'on tumani', 'Uchqo\'rg\'on tumani',
      'Uychi tumani', 'Yangiqo\'rg\'on tumani',
    ],
  },
  {
    name: "Samarqand viloyati",
    districts: [
      'Samarqand shahri', 'Bulung\'ur tumani', 'Ishtixon tumani', 'Jomboy tumani', 'Kattaqo\'rg\'on tumani',
      'Narpay tumani', 'Nurobod tumani', 'Oqdaryo tumani', 'Pastdarg\'om tumani', 'Paxtachi tumani',
      'Payariq tumani', 'Qo\'shrabot tumani', 'Tayloq tumani', 'Urgut tumani',
    ],
  },
  {
    name: "Surxondaryo viloyati",
    districts: [
      'Termiz shahri', 'Angor tumani', 'Bandixon tumani', 'Boysun tumani', 'Denov tumani',
      'Jarqo\'rg\'on tumani', 'Muzrabot tumani', 'Oltinsoy tumani', 'Qiziriq tumani', 'Qumqo\'rg\'on tumani',
      'Sariosiyo tumani', 'Sherobod tumani', 'Sho\'rchi tumani', 'Termiz tumani', 'Uzun tumani',
    ],
  },
  {
    name: "Sirdaryo viloyati",
    districts: [
      'Guliston shahri', 'Boyovut tumani', 'Guliston tumani', 'Mirzaobod tumani', 'Oqoltin tumani',
      'Sardoba tumani', 'Sayxunobod tumani', 'Sirdaryo tumani', 'Xovos tumani', 'Yangiyer shahri',
    ],
  },
  {
    name: "Toshkent viloyati",
    districts: [
      'Angren shahri', 'Bekobod tumani', 'Bo\'ka tumani', 'Bo\'stonliq tumani', 'Chinoz tumani',
      'Chirchiq shahri', 'Ohangaron tumani', 'Olmaliq shahri', 'Oqqo\'rg\'on tumani', 'Parkent tumani',
      'Piskent tumani', 'Qibray tumani', 'Quyichirchiq tumani', 'Toshkent tumani', 'Yangiyo\'l tumani',
      'Yuqorichirchiq tumani', 'Zangiota tumani',
    ],
  },
  {
    name: "Toshkent shahri",
    districts: [
      'Bektemir tumani', 'Chilonzor tumani', 'Mirobod tumani', 'Mirzo Ulug\'bek tumani', 'Olmazor tumani',
      'Sergeli tumani', 'Shayxontohur tumani', 'Uchtepa tumani', 'Yakkasaroy tumani', 'Yashnobod tumani',
      'Yunusobod tumani', 'Yangihayot tumani',
    ],
  },
  {
    name: "Xorazm viloyati",
    districts: [
      'Urganch shahri', 'Bog\'ot tumani', 'Gurlan tumani', 'Qoshko\'pir tumani', 'Shovot tumani',
      'Urganch tumani', 'Xiva tumani', 'Xonqa tumani', 'Yangiariq tumani', 'Yangibozor tumani',
    ],
  },
  {
    name: "Qoraqalpog'iston Respublikasi",
    districts: [
      'Nukus shahri', 'Amudaryo tumani', 'Beruniy tumani', 'Chimboy tumani', 'Ellikqala tumani',
      'Kegeyli tumani', 'Mo\'ynoq tumani', 'Nukus tumani', 'Qanliko\'l tumani', 'Qorao\'zak tumani',
      'Shumanay tumani', 'Taxtako\'pir tumani', 'To\'rtko\'l tumani', 'Xo\'jayli tumani',
    ],
  },
];

export const UZ_REGION_NAMES = UZ_REGIONS.map((r) => r.name);

export function getDistrictsForRegion(regionName: string): string[] {
  return UZ_REGIONS.find((r) => r.name === regionName)?.districts ?? [];
}

export function normalizeLocationSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[''`ʻʼ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function filterLocationOptions(options: string[], query: string, limit = 30): string[] {
  const q = normalizeLocationSearch(query);
  if (!q) return options.slice(0, limit);
  return options.filter((o) => normalizeLocationSearch(o).includes(q)).slice(0, limit);
}
