export interface PrescriptionMed {
  name: string;
  dose: string;
  frequency: string;
  duration: string;
}

export const DEFAULT_PRESCRIPTION_TEMPLATES: Array<{
  name: string;
  icd10Code: string;
  medications: PrescriptionMed[];
  instructions: string;
}> = [
  {
    name: 'Gripp — standart',
    icd10Code: 'J11.1',
    medications: [
      { name: 'Paratsetamol', dose: '500 mg', frequency: '3 marta/kun', duration: '5 kun' },
      { name: 'Ibuprofen', dose: '400 mg', frequency: '2 marta/kun', duration: '3 kun' },
    ],
    instructions: 'Ko\'p suyuqlik iching, dam oling. 3 kundan keyin yaxshilanmasa qayta murojaat.',
  },
  {
    name: 'Hipertensiya — dastlabki',
    icd10Code: 'I10',
    medications: [
      { name: 'Amlodipin', dose: '5 mg', frequency: '1 marta/kun', duration: '30 kun' },
    ],
    instructions: 'Qon bosimini kundalik o\'lchang. Tuzni kamaytiring.',
  },
  {
    name: 'Bronxit',
    icd10Code: 'J20.9',
    medications: [
      { name: 'Ambroksol', dose: '30 mg', frequency: '3 marta/kun', duration: '7 kun' },
      { name: 'Paratsetamol', dose: '500 mg', frequency: 'kerak bo\'lganda', duration: '5 kun' },
    ],
    instructions: 'Issiq ichimlik, namlik. Sigaret chekmang.',
  },
  {
    name: 'Gastrit',
    icd10Code: 'K29.7',
    medications: [
      { name: 'Omeprazol', dose: '20 mg', frequency: '1 marta/kun (ertalab)', duration: '14 kun' },
    ],
    instructions: 'Achchiq, qovurilgan ovqatdan saqlaning. Kichik porsiyalar.',
  },
  {
    name: 'Diabet — qo\'llab-quvvatlash',
    icd10Code: 'E11.9',
    medications: [
      { name: 'Metformin', dose: '500 mg', frequency: '2 marta/kun', duration: '30 kun' },
    ],
    instructions: 'Qon shakarini kundalik nazorat qiling. Poyabzal yarasini tekshiring.',
  },
];
