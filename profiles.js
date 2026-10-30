// Vorlagen für verbreitete Schweizer Kundenkarten.
// Farben sind Annäherungen, das Barcode-Format ist ein Vorschlag:
// Wird beim Scannen ein Code erkannt, gilt immer das erkannte Format.
// mark/label = Schriftzug auf dem mitgelieferten Sujet, art = Muster des Sujets.
// Ein echtes Kartenbild kann pro Vorlage in der App hinterlegt werden (Menü ⋯ → Katalog & Sujets).
window.PROFILES = [
  { id: 'migros-cumulus',   name: 'Migros Cumulus',       mark: 'MIGROS',     label: 'Cumulus',      art: 'arc',     color: '#FF6600', fg: '#fff',    format: 'EAN_13',   cat: 'Lebensmittel',       kw: ['cumulus', 'migros'] },
  { id: 'coop-supercard',   name: 'Coop Supercard',       mark: 'Coop',       label: 'Supercard',    art: 'stripes', color: '#E1001A', fg: '#fff',    format: 'EAN_13',   cat: 'Lebensmittel',       kw: ['supercard', 'coop'] },
  { id: 'lidl-plus',        name: 'Lidl Plus',            mark: 'Lidl',       label: 'Plus',         art: 'rings',   color: '#0050AA', fg: '#FFF000', format: 'QR_CODE',  cat: 'Lebensmittel',       kw: ['lidl'] },
  { id: 'aldi',             name: 'ALDI SUISSE',          mark: 'ALDI',       label: 'Suisse',       art: 'diag',    color: '#00205B', fg: '#fff',    format: 'CODE_128', cat: 'Lebensmittel',       kw: ['aldi'] },
  { id: 'volg',             name: 'Volg',                 mark: 'Volg',       label: 'Kundenkarte',  art: 'wave',    color: '#D6001C', fg: '#fff',    format: 'EAN_13',   cat: 'Lebensmittel',       kw: ['volg'] },
  { id: 'manor',            name: 'Manor myManor',        mark: 'MANOR',      label: 'myManor',      art: 'split',   color: '#C8102E', fg: '#fff',    format: 'CODE_128', cat: 'Warenhaus',          kw: ['manor'] },
  { id: 'globus',           name: 'Globus',               mark: 'GLOBUS',     label: 'Card',         art: 'grid',    color: '#111111', fg: '#fff',    format: 'CODE_128', cat: 'Warenhaus',          kw: ['globus'] },
  { id: 'ikea-family',      name: 'IKEA Family',          mark: 'IKEA',       label: 'Family',       art: 'split',   color: '#0058A3', fg: '#FFDA1A', format: 'CODE_128', cat: 'Wohnen & Bau',       kw: ['ikea', 'family'] },
  { id: 'jumbo',            name: 'Jumbo',                mark: 'JUMBO',      label: 'Card',         art: 'diag',    color: '#FFCC00', fg: '#111',    format: 'CODE_128', cat: 'Wohnen & Bau',       kw: ['jumbo'] },
  { id: 'hornbach',         name: 'Hornbach',             mark: 'HORNBACH',   label: 'Profi-Card',   art: 'stripes', color: '#F7821B', fg: '#111',    format: 'CODE_128', cat: 'Wohnen & Bau',       kw: ['hornbach'] },
  { id: 'bauhaus',          name: 'Bauhaus',              mark: 'BAUHAUS',    label: 'Kundenkarte',  art: 'grid',    color: '#D7001C', fg: '#fff',    format: 'CODE_128', cat: 'Wohnen & Bau',       kw: ['bauhaus'] },
  { id: 'pfister',          name: 'Pfister',              mark: 'Pfister',    label: 'Card',         art: 'arc',     color: '#1C1C1C', fg: '#fff',    format: 'CODE_128', cat: 'Wohnen & Bau',       kw: ['pfister'] },
  { id: 'landi',            name: 'LANDI',                mark: 'LANDI',      label: 'Kundenkarte',  art: 'wave',    color: '#E30613', fg: '#fff',    format: 'EAN_13',   cat: 'Wohnen & Bau',       kw: ['landi'] },
  { id: 'ochsner-sport',    name: 'Ochsner Sport Club',   mark: 'OCHSNER',    label: 'Sport Club',   art: 'diag',    color: '#E2001A', fg: '#fff',    format: 'CODE_128', cat: 'Sport',              kw: ['ochsner'] },
  { id: 'decathlon',        name: 'Decathlon',            mark: 'DECATHLON',  label: 'Member',       art: 'wave',    color: '#0082C3', fg: '#fff',    format: 'EAN_13',   cat: 'Sport',              kw: ['decathlon'] },
  { id: 'sportx',           name: 'SportX',               mark: 'SportX',     label: 'Club',         art: 'stripes', color: '#1D1D1B', fg: '#fff',    format: 'CODE_128', cat: 'Sport',              kw: ['sportx'] },
  { id: 'mediamarkt',       name: 'myMediaMarkt',         mark: 'MediaMarkt', label: 'myMediaMarkt', art: 'rings',   color: '#DF0000', fg: '#fff',    format: 'CODE_128', cat: 'Elektronik',         kw: ['mediamarkt', 'media markt'] },
  { id: 'fust',             name: 'Fust',                 mark: 'FUST',       label: 'Card',         art: 'split',   color: '#E30613', fg: '#fff',    format: 'CODE_128', cat: 'Elektronik',         kw: ['fust'] },
  { id: 'amavita',          name: 'Amavita',              mark: 'Amavita',    label: 'Card',         art: 'dots',    color: '#00843D', fg: '#fff',    format: 'EAN_13',   cat: 'Drogerie & Beauty',  kw: ['amavita'] },
  { id: 'sunstore',         name: 'Sun Store',            mark: 'Sun Store',  label: 'Card',         art: 'rings',   color: '#F39200', fg: '#fff',    format: 'EAN_13',   cat: 'Drogerie & Beauty',  kw: ['sun store', 'sunstore'] },
  { id: 'coop-vitality',    name: 'Coop Vitality',        mark: 'Coop',       label: 'Vitality',     art: 'dots',    color: '#008C45', fg: '#fff',    format: 'EAN_13',   cat: 'Drogerie & Beauty',  kw: ['vitality'] },
  { id: 'mueller',          name: 'Müller',               mark: 'Müller',     label: 'Kundenkarte',  art: 'wave',    color: '#F07D00', fg: '#fff',    format: 'EAN_13',   cat: 'Drogerie & Beauty',  kw: ['müller', 'mueller'] },
  { id: 'douglas',          name: 'Douglas Beauty Card',  mark: 'DOUGLAS',    label: 'Beauty Card',  art: 'arc',     color: '#9BDCD2', fg: '#111',    format: 'CODE_128', cat: 'Drogerie & Beauty',  kw: ['douglas'] },
  { id: 'marionnaud',       name: 'Marionnaud',           mark: 'MARIONNAUD', label: 'Card',         art: 'grid',    color: '#1A1A1A', fg: '#fff',    format: 'CODE_128', cat: 'Drogerie & Beauty',  kw: ['marionnaud'] },
  { id: 'import-parfumerie',name: 'Import Parfumerie',    mark: 'IMPORT',     label: 'Parfumerie',   art: 'arc',     color: '#2B2B2B', fg: '#fff',    format: 'CODE_128', cat: 'Drogerie & Beauty',  kw: ['import parfumerie', 'impo'] },
  { id: 'hm',               name: 'H&M Member',           mark: 'H&M',        label: 'Member',       art: 'split',   color: '#E50010', fg: '#fff',    format: 'QR_CODE',  cat: 'Mode',               kw: ['h&m', 'h & m'] },
  { id: 'dosenbach',        name: 'Dosenbach',            mark: 'DOSENBACH',  label: 'Club',         art: 'stripes', color: '#E30613', fg: '#fff',    format: 'CODE_128', cat: 'Mode',               kw: ['dosenbach'] },
  { id: 'exlibris',         name: 'Ex Libris',            mark: 'Ex Libris',  label: 'Card',         art: 'grid',    color: '#003C71', fg: '#fff',    format: 'CODE_128', cat: 'Bücher & Medien',    kw: ['ex libris', 'exlibris'] },
  { id: 'orell-fuessli',    name: 'Orell Füssli',         mark: 'Orell Füssli', label: 'Card',       art: 'arc',     color: '#00305E', fg: '#fff',    format: 'CODE_128', cat: 'Bücher & Medien',    kw: ['orell', 'füssli'] },
  { id: 'qualipet',         name: 'Qualipet',             mark: 'Qualipet',   label: 'Card',         art: 'dots',    color: '#009FE3', fg: '#fff',    format: 'CODE_128', cat: 'Tiere',              kw: ['qualipet'] },
  { id: 'fressnapf',        name: 'Fressnapf',            mark: 'Fressnapf',  label: 'Freunde',      art: 'dots',    color: '#00873C', fg: '#fff',    format: 'CODE_128', cat: 'Tiere',              kw: ['fressnapf'] },
  { id: 'bibliothek',       name: 'Bibliothek',           mark: 'Bibliothek', label: 'Ausweis',      art: 'grid',    color: '#5856D6', fg: '#fff',    format: 'CODE_39',  cat: 'Freizeit',           kw: ['bibliothek', 'library', 'bibliothèque'] },
  { id: 'fitness',          name: 'Fitness-Abo',          mark: 'Fitness',    label: 'Mitglied',     art: 'diag',    color: '#30B0C7', fg: '#fff',    format: 'QR_CODE',  cat: 'Sport',              kw: ['fitness', 'gym'] },
];

window.CATEGORIES = ['Lebensmittel', 'Warenhaus', 'Mode', 'Drogerie & Beauty', 'Wohnen & Bau', 'Sport',
  'Elektronik', 'Bücher & Medien', 'Tiere', 'Mobilität', 'Freizeit', 'Sonstiges'];

window.FORMATS = [
  ['EAN_13', 'EAN-13'], ['EAN_8', 'EAN-8'], ['UPC_A', 'UPC-A'], ['CODE_128', 'Code 128'],
  ['CODE_39', 'Code 39'], ['ITF', 'ITF'], ['CODABAR', 'Codabar'], ['QR_CODE', 'QR-Code'],
  ['AZTEC', 'Aztec'], ['DATA_MATRIX', 'Data Matrix'], ['NONE', 'Kein Code'],
];
