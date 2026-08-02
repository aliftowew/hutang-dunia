/*
 * Data hutang pemerintah negara-negara besar dunia.
 *
 * PENTING — data ini adalah PERKIRAAN untuk tujuan edukasi/visualisasi,
 * dirangkum dari sumber publik (IMF World Economic Outlook, World Bank,
 * dan dokumen APBN/anggaran nasional), periode sekitar 2023–2024.
 * Angka dibulatkan dan BUKAN angka resmi. Selalu cek sumber asli untuk data akurat.
 *
 * Kolom:
 *  iso            : kode ISO 3166-1 numerik (untuk mencocokkan dengan peta)
 *  name           : nama negara (Indonesia)
 *  region         : kawasan
 *  gdpUsdBn       : PDB nominal (miliar USD)
 *  debtToGdp      : rasio utang pemerintah terhadap PDB (%)
 *  interestToRev  : pembayaran bunga utang sebagai % dari pendapatan negara
 *                   (proksi "berapa besar APBN tersedot untuk membayar utang")
 *
 * debtUsdBn (nilai utang absolut) dihitung otomatis = gdpUsdBn * debtToGdp / 100
 */
const RAW_DEBT_DATA = [
  // iso   name                 region              gdp     d/gdp  int/rev
  ['840', 'Amerika Serikat',    'Amerika Utara',    29000,  121,   16],
  ['392', 'Jepang',             'Asia Timur',        4100,  236,    8],
  ['156', 'Tiongkok',           'Asia Timur',       18500,   88,    6],
  ['276', 'Jerman',             'Eropa',             4500,   63,    3],
  ['356', 'India',              'Asia Selatan',      3900,   83,   24],
  ['826', 'Inggris',            'Eropa',             3600,  101,    9],
  ['250', 'Prancis',            'Eropa',             3100,  111,    5],
  ['380', 'Italia',             'Eropa',             2300,  135,    8],
  ['076', 'Brasil',             'Amerika Selatan',   2200,   87,   18],
  ['124', 'Kanada',             'Amerika Utara',     2200,  105,    8],
  ['643', 'Rusia',              'Eropa/Asia',        2200,   20,    5],
  ['410', 'Korea Selatan',      'Asia Timur',        1800,   56,    4],
  ['036', 'Australia',          'Oseania',           1750,   50,    5],
  ['484', 'Meksiko',            'Amerika Utara',     1850,   58,   12],
  ['724', 'Spanyol',            'Eropa',             1650,  105,    6],
  ['360', 'Indonesia',          'Asia Tenggara',     1450,   39,   17],
  ['528', 'Belanda',            'Eropa',             1150,   47,    3],
  ['682', 'Arab Saudi',         'Timur Tengah',      1100,   30,    5],
  ['792', 'Turki',              'Timur Tengah',      1150,   27,   12],
  ['756', 'Swiss',              'Eropa',              940,   38,    2],
  ['032', 'Argentina',          'Amerika Selatan',    640,  155,   20],
  ['300', 'Yunani',             'Eropa',              250,  154,    7],
  ['620', 'Portugal',           'Eropa',              300,   95,    6],
  ['056', 'Belgia',             'Eropa',              660,  105,    5],
  ['752', 'Swedia',             'Eropa',              620,   33,    2],
  ['616', 'Polandia',           'Eropa',              840,   55,    9],
  ['040', 'Austria',            'Eropa',              540,   74,    4],
  ['578', 'Norwegia',           'Eropa',              500,   44,    1],
  ['818', 'Mesir',              'Afrika/Timteng',     350,   96,   50],
  ['710', 'Afrika Selatan',     'Afrika',             400,   75,   21],
  ['566', 'Nigeria',            'Afrika',             400,   46,   48],
  ['586', 'Pakistan',           'Asia Selatan',       340,   71,   50],
  ['764', 'Thailand',           'Asia Tenggara',      550,   64,    7],
  ['458', 'Malaysia',           'Asia Tenggara',      440,   67,   15],
  ['608', 'Filipina',           'Asia Tenggara',      470,   57,   13],
  ['704', 'Vietnam',            'Asia Tenggara',      470,   34,    6],
  ['702', 'Singapura',          'Asia Tenggara',      530,  168,    5],
  ['804', 'Ukraina',            'Eropa',              190,   92,   12],
  ['170', 'Kolombia',           'Amerika Selatan',    420,   55,   15],
  ['152', 'Chili',              'Amerika Selatan',    330,   41,    6],
  ['050', 'Bangladesh',         'Asia Selatan',       460,   39,   20],
  ['364', 'Iran',               'Timur Tengah',       400,   34,    6],
];

const DEBT_DATA = RAW_DEBT_DATA.map(function (r) {
  var gdp = r[3], d2g = r[4];
  return {
    iso: r[0],
    name: r[1],
    region: r[2],
    gdpUsdBn: gdp,
    debtToGdp: d2g,
    interestToRev: r[5],
    debtUsdBn: Math.round(gdp * d2g / 100),
  };
});

// Peta cepat iso -> data
const DEBT_BY_ISO = {};
DEBT_DATA.forEach(function (d) { DEBT_BY_ISO[d.iso] = d; });

// Definisi metrik yang bisa ditampilkan
const METRICS = {
  debtToGdp: {
    key: 'debtToGdp',
    label: 'Utang terhadap PDB',
    short: 'Utang/PDB',
    unit: '%',
    desc: 'Seberapa besar total utang pemerintah dibanding ukuran ekonomi (PDB) negara. Di atas 100% berarti utang melebihi PDB satu tahun.',
    colors: ['#e8f0fb', '#9dc3f0', '#4b8fe3', '#2456a6', '#0d2b5e'],
    domain: [0, 60, 100, 150, 240],
  },
  interestToRev: {
    key: 'interestToRev',
    label: 'Beban bunga terhadap pendapatan negara',
    short: 'Bunga/APBN',
    unit: '%',
    desc: 'Berapa persen pendapatan negara (APBN) tersedot hanya untuk membayar bunga utang setiap tahun. Makin tinggi makin sedikit uang tersisa untuk belanja publik.',
    colors: ['#eafaf1', '#a7e3c3', '#4fbf87', '#e0a83b', '#c0392b'],
    domain: [0, 10, 20, 35, 55],
  },
  debtUsdBn: {
    key: 'debtUsdBn',
    label: 'Nilai utang absolut (USD)',
    short: 'Utang (USD)',
    unit: ' M USD',
    desc: 'Total nilai utang pemerintah dalam miliar dolar AS. Menunjukkan ukuran utang yang sebenarnya, bukan rasio.',
    colors: ['#f3ecfa', '#c9aee8', '#9b6fd4', '#6f3fb0', '#3f1d73'],
    domain: [0, 1000, 3000, 8000, 36000],
  },
};
