export interface ZimbabwePoliceOfficer {
  id: string;
  name: string;
  rank:
    | "Assistant Inspector"
    | "Sergeant"
    | "Constable"
    | "Detective Assistant Inspector"
    | "Detective Sergeant"
    | "Detective Constable";
}

export interface ZimbabwePoliceStation {
  id: string;
  name: string;
  province: string;
  district: string;
  officers: ZimbabwePoliceOfficer[];
}

function officer(
  stationId: string,
  index: number,
  name: string,
  rank: ZimbabwePoliceOfficer["rank"],
): ZimbabwePoliceOfficer {
  return {
    id: `${stationId}-officer-${index}`,
    name,
    rank,
  };
}

/**
 * Station names represent established Zimbabwe Republic Police stations.
 * Officer names are intentionally fictional demonstration records.
 */
export const ZIMBABWE_POLICE_STATIONS: ZimbabwePoliceStation[] = [
  {
    id: "harare-central",
    name: "Harare Central Police Station",
    province: "Harare",
    district: "Harare Central",
    officers: [
      officer("harare-central", 1, "Tendai Muchengeti", "Assistant Inspector"),
      officer("harare-central", 2, "Rudo Chikowore", "Detective Sergeant"),
      officer("harare-central", 3, "Tatenda Moyo", "Sergeant"),
      officer("harare-central", 4, "Nyasha Chireka", "Detective Constable"),
    ],
  },
  {
    id: "avondale",
    name: "Avondale Police Station",
    province: "Harare",
    district: "Harare Central",
    officers: [
      officer("avondale", 1, "Kudakwashe Mupfumi", "Sergeant"),
      officer("avondale", 2, "Vimbai Mutasa", "Constable"),
      officer("avondale", 3, "Tinashe Hove", "Detective Constable"),
      officer("avondale", 4, "Chipo Marufu", "Assistant Inspector"),
    ],
  },
  {
    id: "borrowdale",
    name: "Borrowdale Police Station",
    province: "Harare",
    district: "Harare North",
    officers: [
      officer("borrowdale", 1, "Farai Muchengeti", "Assistant Inspector"),
      officer("borrowdale", 2, "Memory Chitiyo", "Sergeant"),
      officer("borrowdale", 3, "Simbarashe Gono", "Constable"),
      officer("borrowdale", 4, "Rumbidzai Mhike", "Detective Sergeant"),
    ],
  },
  {
    id: "mabelreign",
    name: "Mabelreign Police Station",
    province: "Harare",
    district: "Harare West",
    officers: [
      officer("mabelreign", 1, "Takudzwa Bako", "Sergeant"),
      officer("mabelreign", 2, "Rutendo Chari", "Constable"),
      officer("mabelreign", 3, "Munyaradzi Dube", "Detective Constable"),
      officer("mabelreign", 4, "Shamiso Zhou", "Assistant Inspector"),
    ],
  },
  {
    id: "marlborough",
    name: "Marlborough Police Station",
    province: "Harare",
    district: "Harare West",
    officers: [
      officer("marlborough", 1, "Blessing Mataruse", "Sergeant"),
      officer("marlborough", 2, "Nomsa Ncube", "Constable"),
      officer("marlborough", 3, "Tafadzwa Macheka", "Detective Sergeant"),
      officer("marlborough", 4, "Panashe Chiweshe", "Constable"),
    ],
  },
  {
    id: "mabvuku",
    name: "Mabvuku Police Station",
    province: "Harare",
    district: "Harare East",
    officers: [
      officer("mabvuku", 1, "Charles Mavhunga", "Assistant Inspector"),
      officer("mabvuku", 2, "Tariro Mupambirei", "Sergeant"),
      officer("mabvuku", 3, "Brian Choga", "Constable"),
      officer("mabvuku", 4, "Patience Mudzonga", "Detective Constable"),
    ],
  },
  {
    id: "macheke",
    name: "Macheke Police Station",
    province: "Mashonaland East",
    district: "Murehwa",
    officers: [
      officer("macheke", 1, "Gift Mapondera", "Sergeant"),
      officer("macheke", 2, "Mercy Chiromo", "Constable"),
      officer("macheke", 3, "Alfred Chigariro", "Detective Constable"),
      officer("macheke", 4, "Joyce Chivasa", "Assistant Inspector"),
    ],
  },
  {
    id: "bulawayo-central",
    name: "Bulawayo Central Police Station",
    province: "Bulawayo",
    district: "Bulawayo Central",
    officers: [
      officer("bulawayo-central", 1, "Nkosilathi Sibanda", "Assistant Inspector"),
      officer("bulawayo-central", 2, "Thandekile Ndlovu", "Detective Sergeant"),
      officer("bulawayo-central", 3, "Mthokozisi Moyo", "Sergeant"),
      officer("bulawayo-central", 4, "Nomvelo Dube", "Constable"),
    ],
  },
  {
    id: "hillside",
    name: "Hillside Police Station",
    province: "Bulawayo",
    district: "Bulawayo Central",
    officers: [
      officer("hillside", 1, "Sibongile Ncube", "Sergeant"),
      officer("hillside", 2, "Bhekizitha Mpofu", "Constable"),
      officer("hillside", 3, "Lindiwe Nyathi", "Detective Constable"),
      officer("hillside", 4, "Themba Mhlanga", "Assistant Inspector"),
    ],
  },
  {
    id: "luveve",
    name: "Luveve Police Station",
    province: "Bulawayo",
    district: "Bulawayo West",
    officers: [
      officer("luveve", 1, "Musa Ndlovu", "Sergeant"),
      officer("luveve", 2, "Nqobile Moyo", "Constable"),
      officer("luveve", 3, "Siyabonga Sibanda", "Detective Sergeant"),
      officer("luveve", 4, "Precious Nyoni", "Constable"),
    ],
  },
  {
    id: "nkulumane",
    name: "Nkulumane Police Station",
    province: "Bulawayo",
    district: "Bulawayo West",
    officers: [
      officer("nkulumane", 1, "Dumisani Mpofu", "Assistant Inspector"),
      officer("nkulumane", 2, "Zanele Dube", "Sergeant"),
      officer("nkulumane", 3, "Mandla Ncube", "Constable"),
      officer("nkulumane", 4, "Nozipho Moyo", "Detective Constable"),
    ],
  },
  {
    id: "bindura-central",
    name: "Bindura Central Police Station",
    province: "Mashonaland Central",
    district: "Bindura",
    officers: [
      officer("bindura-central", 1, "Tapiwa Chitauro", "Assistant Inspector"),
      officer("bindura-central", 2, "Fungai Makoni", "Detective Sergeant"),
      officer("bindura-central", 3, "Ropafadzo Chikomba", "Sergeant"),
      officer("bindura-central", 4, "Kundai Mhere", "Constable"),
    ],
  },
  {
    id: "chipadze",
    name: "Chipadze Police Station",
    province: "Mashonaland Central",
    district: "Bindura",
    officers: [
      officer("chipadze", 1, "Tinotenda Mavhunga", "Sergeant"),
      officer("chipadze", 2, "Anesu Chikomo", "Constable"),
      officer("chipadze", 3, "Munashe Chitando", "Detective Constable"),
      officer("chipadze", 4, "Tariro Chisango", "Assistant Inspector"),
    ],
  },
  {
    id: "mazowe",
    name: "Mazowe Police Station",
    province: "Mashonaland Central",
    district: "Mazowe",
    officers: [
      officer("mazowe", 1, "Admire Zenda", "Assistant Inspector"),
      officer("mazowe", 2, "Chiedza Gwatidzo", "Sergeant"),
      officer("mazowe", 3, "Tanaka Chihota", "Constable"),
      officer("mazowe", 4, "Loveness Makaza", "Detective Constable"),
    ],
  },
  {
    id: "mutare-central",
    name: "Mutare Central Police Station",
    province: "Manicaland",
    district: "Mutare",
    officers: [
      officer("mutare-central", 1, "Tonderai Chigwedere", "Assistant Inspector"),
      officer("mutare-central", 2, "Rumbidzai Mutambara", "Detective Sergeant"),
      officer("mutare-central", 3, "Lloyd Mupfumi", "Sergeant"),
      officer("mutare-central", 4, "Sharon Manyika", "Constable"),
    ],
  },
  {
    id: "sakubva",
    name: "Sakubva Police Station",
    province: "Manicaland",
    district: "Mutare",
    officers: [
      officer("sakubva", 1, "Knowledge Nyakonda", "Sergeant"),
      officer("sakubva", 2, "Faith Chikore", "Constable"),
      officer("sakubva", 3, "Tinashe Muchena", "Detective Constable"),
      officer("sakubva", 4, "Audrey Chitiyo", "Assistant Inspector"),
    ],
  },
  {
    id: "rusape",
    name: "Rusape Police Station",
    province: "Manicaland",
    district: "Makoni",
    officers: [
      officer("rusape", 1, "Lovemore Chikukwa", "Assistant Inspector"),
      officer("rusape", 2, "Tsitsi Mutsvairo", "Sergeant"),
      officer("rusape", 3, "Elton Mazarura", "Constable"),
      officer("rusape", 4, "Charity Mlambo", "Detective Constable"),
    ],
  },
  {
    id: "gweru-central",
    name: "Gweru Central Police Station",
    province: "Midlands",
    district: "Gweru",
    officers: [
      officer("gweru-central", 1, "Tawanda Moyo", "Assistant Inspector"),
      officer("gweru-central", 2, "Sithembile Ncube", "Detective Sergeant"),
      officer("gweru-central", 3, "Kelvin Shoko", "Sergeant"),
      officer("gweru-central", 4, "Nyaradzo Mathe", "Constable"),
    ],
  },
  {
    id: "mkoba",
    name: "Mkoba Police Station",
    province: "Midlands",
    district: "Gweru",
    officers: [
      officer("mkoba", 1, "Edmore Mashingaidze", "Sergeant"),
      officer("mkoba", 2, "Prudence Moyo", "Constable"),
      officer("mkoba", 3, "Ngonidzashe Dube", "Detective Constable"),
      officer("mkoba", 4, "Violet Chuma", "Assistant Inspector"),
    ],
  },
  {
    id: "kwekwe-central",
    name: "Kwekwe Central Police Station",
    province: "Midlands",
    district: "Kwekwe",
    officers: [
      officer("kwekwe-central", 1, "Shepherd Chikomba", "Assistant Inspector"),
      officer("kwekwe-central", 2, "Lilian Ndlovu", "Sergeant"),
      officer("kwekwe-central", 3, "Tatenda Gandiwa", "Constable"),
      officer("kwekwe-central", 4, "Mildred Moyo", "Detective Constable"),
    ],
  },
  {
    id: "masvingo-central",
    name: "Masvingo Central Police Station",
    province: "Masvingo",
    district: "Masvingo",
    officers: [
      officer("masvingo-central", 1, "Munyaradzi Chivasa", "Assistant Inspector"),
      officer("masvingo-central", 2, "Ratidzo Mhere", "Detective Sergeant"),
      officer("masvingo-central", 3, "Obert Mupfumira", "Sergeant"),
      officer("masvingo-central", 4, "Chipo Zindoga", "Constable"),
    ],
  },
  {
    id: "chikato",
    name: "Chikato Police Station",
    province: "Masvingo",
    district: "Masvingo",
    officers: [
      officer("chikato", 1, "Tendai Madzivire", "Sergeant"),
      officer("chikato", 2, "Rejoice Chitima", "Constable"),
      officer("chikato", 3, "Pardon Mavengere", "Detective Constable"),
      officer("chikato", 4, "Agnes Chibanda", "Assistant Inspector"),
    ],
  },
  {
    id: "chinhoyi-central",
    name: "Chinhoyi Central Police Station",
    province: "Mashonaland West",
    district: "Makonde",
    officers: [
      officer("chinhoyi-central", 1, "Brighton Muchenje", "Assistant Inspector"),
      officer("chinhoyi-central", 2, "Nyasha Nyamupfukudza", "Sergeant"),
      officer("chinhoyi-central", 3, "Melody Chigora", "Constable"),
      officer("chinhoyi-central", 4, "Washington Zulu", "Detective Constable"),
    ],
  },
  {
    id: "kadoma-central",
    name: "Kadoma Central Police Station",
    province: "Mashonaland West",
    district: "Kadoma",
    officers: [
      officer("kadoma-central", 1, "Godfrey Shonhiwa", "Assistant Inspector"),
      officer("kadoma-central", 2, "Bridget Chirehwa", "Sergeant"),
      officer("kadoma-central", 3, "Prince Marume", "Constable"),
      officer("kadoma-central", 4, "Eunice Mataruse", "Detective Constable"),
    ],
  },
  {
    id: "marondera-central",
    name: "Marondera Central Police Station",
    province: "Mashonaland East",
    district: "Marondera",
    officers: [
      officer("marondera-central", 1, "Isaac Chiweshe", "Assistant Inspector"),
      officer("marondera-central", 2, "Florence Mupeti", "Detective Sergeant"),
      officer("marondera-central", 3, "Tafara Chigudu", "Sergeant"),
      officer("marondera-central", 4, "Makanaka Mutero", "Constable"),
    ],
  },
  {
    id: "victoria-falls",
    name: "Victoria Falls Police Station",
    province: "Matabeleland North",
    district: "Hwange",
    officers: [
      officer("victoria-falls", 1, "Siphiwe Ndlovu", "Assistant Inspector"),
      officer("victoria-falls", 2, "Bongani Moyo", "Sergeant"),
      officer("victoria-falls", 3, "Nobuhle Sibanda", "Constable"),
      officer("victoria-falls", 4, "Dumisani Nyoni", "Detective Constable"),
    ],
  },
  {
    id: "hwange",
    name: "Hwange Police Station",
    province: "Matabeleland North",
    district: "Hwange",
    officers: [
      officer("hwange", 1, "Sikhumbuzo Mpofu", "Assistant Inspector"),
      officer("hwange", 2, "Tholakele Dube", "Sergeant"),
      officer("hwange", 3, "Mandla Nkomo", "Constable"),
      officer("hwange", 4, "Lungile Moyo", "Detective Constable"),
    ],
  },
  {
    id: "gwanda",
    name: "Gwanda Police Station",
    province: "Matabeleland South",
    district: "Gwanda",
    officers: [
      officer("gwanda", 1, "Mcebisi Ndlovu", "Assistant Inspector"),
      officer("gwanda", 2, "Sanelisiwe Moyo", "Sergeant"),
      officer("gwanda", 3, "Prosper Sibanda", "Constable"),
      officer("gwanda", 4, "Nompumelelo Dube", "Detective Constable"),
    ],
  },
  {
    id: "beitbridge",
    name: "Beitbridge Police Station",
    province: "Matabeleland South",
    district: "Beitbridge",
    officers: [
      officer("beitbridge", 1, "Welcome Moyo", "Assistant Inspector"),
      officer("beitbridge", 2, "Thandiwe Ncube", "Detective Sergeant"),
      officer("beitbridge", 3, "Pride Mpofu", "Sergeant"),
      officer("beitbridge", 4, "Lwazi Sibanda", "Constable"),
    ],
  },
].sort((left, right) => left.name.localeCompare(right.name));

export function getPoliceStationByName(
  stationName: string,
): ZimbabwePoliceStation | null {
  return (
    ZIMBABWE_POLICE_STATIONS.find(
      (station) => station.name === stationName,
    ) ?? null
  );
}

export function getOfficerDisplayName(
  officer: ZimbabwePoliceOfficer,
): string {
  return `${officer.rank} ${officer.name}`;
}
