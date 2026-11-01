const DD_NAME_MAP = {
  'Wukong': 'MonkeyKing',
  'Renata Glasc': 'Renata',
  'LeBlanc': 'Leblanc',
  'Cho\'Gath': 'Chogath',
  'Kai\'Sa': 'Kaisa',
  'Kha\'Zix': 'Khazix',
  'Kog\'Maw': 'KogMaw',
  'Vel\'Koz': 'Velkoz',
  'Bel\'Veth': 'Belveth',
  'K\'Sante': 'KSante',
  'Dr. Mundo': 'DrMundo',
  'Nunu & Willump': 'Nunu',
  'Jarvan IV': 'JarvanIV',
  'Xin Zhao': 'XinZhao',
  'Aurelion Sol': 'AurelionSol',
  'Tahm Kench': 'TahmKench',
  'Master Yi': 'MasterYi',
  'Twisted Fate': 'TwistedFate',
  'Miss Fortune': 'MissFortune',
};

export function formatPatch(rawPatch) {
  if (!rawPatch) return '';
  return rawPatch.replace(/^16\./, '26.');
}

export function getDDragonKey(name) {
  if (!name) return '';
  return DD_NAME_MAP[name] || name.replace(/[^a-zA-Z0-9]/g, '');
}

export function getChampIconUrl(name, ddragonVersion) {
  if (!name || !ddragonVersion) return '';
  const champKey = getDDragonKey(name);
  return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${champKey}.png`;
}

export function getPrimaryRole(rolesObj) {
  if (!rolesObj) return 'desconocido';
  const entries = Object.entries(rolesObj);
  if (entries.length === 0) return 'desconocido';
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}