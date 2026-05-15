/**
 * FLOWTYM — Country list (FR labels, ISO-3166 alpha-2, emoji flags).
 *
 * Subset covers ~150 commonly used nationalities for hotel guests. List is
 * already French-sorted (collator-aware) at module import time.
 */
export interface Country { code: string; name: string; flag: string }

const RAW: Array<[string, string, string]> = [
  ['AF', 'Afghanistan', '🇦🇫'], ['ZA', 'Afrique du Sud', '🇿🇦'], ['AL', 'Albanie', '🇦🇱'],
  ['DZ', 'Algérie', '🇩🇿'], ['DE', 'Allemagne', '🇩🇪'], ['AD', 'Andorre', '🇦🇩'],
  ['AO', 'Angola', '🇦🇴'], ['SA', 'Arabie Saoudite', '🇸🇦'], ['AR', 'Argentine', '🇦🇷'],
  ['AM', 'Arménie', '🇦🇲'], ['AU', 'Australie', '🇦🇺'], ['AT', 'Autriche', '🇦🇹'],
  ['AZ', 'Azerbaïdjan', '🇦🇿'], ['BH', 'Bahreïn', '🇧🇭'], ['BD', 'Bangladesh', '🇧🇩'],
  ['BE', 'Belgique', '🇧🇪'], ['BZ', 'Belize', '🇧🇿'], ['BJ', 'Bénin', '🇧🇯'],
  ['BO', 'Bolivie', '🇧🇴'], ['BA', 'Bosnie-Herzégovine', '🇧🇦'], ['BW', 'Botswana', '🇧🇼'],
  ['BR', 'Brésil', '🇧🇷'], ['BG', 'Bulgarie', '🇧🇬'], ['BF', 'Burkina Faso', '🇧🇫'],
  ['BI', 'Burundi', '🇧🇮'], ['KH', 'Cambodge', '🇰🇭'], ['CM', 'Cameroun', '🇨🇲'],
  ['CA', 'Canada', '🇨🇦'], ['CL', 'Chili', '🇨🇱'], ['CN', 'Chine', '🇨🇳'],
  ['CY', 'Chypre', '🇨🇾'], ['CO', 'Colombie', '🇨🇴'], ['KM', 'Comores', '🇰🇲'],
  ['CG', 'Congo', '🇨🇬'], ['CD', 'Congo (RDC)', '🇨🇩'], ['KR', 'Corée du Sud', '🇰🇷'],
  ['CR', 'Costa Rica', '🇨🇷'], ['CI', "Côte d'Ivoire", '🇨🇮'], ['HR', 'Croatie', '🇭🇷'],
  ['CU', 'Cuba', '🇨🇺'], ['DK', 'Danemark', '🇩🇰'], ['DJ', 'Djibouti', '🇩🇯'],
  ['DO', 'Dominique', '🇩🇲'], ['EG', 'Égypte', '🇪🇬'], ['SV', 'Salvador', '🇸🇻'],
  ['AE', 'Émirats Arabes Unis', '🇦🇪'], ['EC', 'Équateur', '🇪🇨'], ['ER', 'Érythrée', '🇪🇷'],
  ['ES', 'Espagne', '🇪🇸'], ['EE', 'Estonie', '🇪🇪'], ['US', 'États-Unis', '🇺🇸'],
  ['ET', 'Éthiopie', '🇪🇹'], ['FJ', 'Fidji', '🇫🇯'], ['FI', 'Finlande', '🇫🇮'],
  ['FR', 'France', '🇫🇷'], ['GA', 'Gabon', '🇬🇦'], ['GM', 'Gambie', '🇬🇲'],
  ['GE', 'Géorgie', '🇬🇪'], ['GH', 'Ghana', '🇬🇭'], ['GR', 'Grèce', '🇬🇷'],
  ['GT', 'Guatemala', '🇬🇹'], ['GN', 'Guinée', '🇬🇳'], ['GW', 'Guinée-Bissau', '🇬🇼'],
  ['GQ', 'Guinée Équatoriale', '🇬🇶'], ['HT', 'Haïti', '🇭🇹'], ['HN', 'Honduras', '🇭🇳'],
  ['HU', 'Hongrie', '🇭🇺'], ['IN', 'Inde', '🇮🇳'], ['ID', 'Indonésie', '🇮🇩'],
  ['IQ', 'Irak', '🇮🇶'], ['IR', 'Iran', '🇮🇷'], ['IE', 'Irlande', '🇮🇪'],
  ['IS', 'Islande', '🇮🇸'], ['IL', 'Israël', '🇮🇱'], ['IT', 'Italie', '🇮🇹'],
  ['JM', 'Jamaïque', '🇯🇲'], ['JP', 'Japon', '🇯🇵'], ['JO', 'Jordanie', '🇯🇴'],
  ['KZ', 'Kazakhstan', '🇰🇿'], ['KE', 'Kenya', '🇰🇪'], ['KG', 'Kirghizistan', '🇰🇬'],
  ['XK', 'Kosovo', '🇽🇰'], ['KW', 'Koweït', '🇰🇼'], ['LA', 'Laos', '🇱🇦'],
  ['LS', 'Lesotho', '🇱🇸'], ['LV', 'Lettonie', '🇱🇻'], ['LB', 'Liban', '🇱🇧'],
  ['LR', 'Libéria', '🇱🇷'], ['LY', 'Libye', '🇱🇾'], ['LI', 'Liechtenstein', '🇱🇮'],
  ['LT', 'Lituanie', '🇱🇹'], ['LU', 'Luxembourg', '🇱🇺'], ['MK', 'Macédoine du Nord', '🇲🇰'],
  ['MG', 'Madagascar', '🇲🇬'], ['MY', 'Malaisie', '🇲🇾'], ['MW', 'Malawi', '🇲🇼'],
  ['MV', 'Maldives', '🇲🇻'], ['ML', 'Mali', '🇲🇱'], ['MT', 'Malte', '🇲🇹'],
  ['MA', 'Maroc', '🇲🇦'], ['MR', 'Mauritanie', '🇲🇷'], ['MU', 'Maurice', '🇲🇺'],
  ['MX', 'Mexique', '🇲🇽'], ['MD', 'Moldavie', '🇲🇩'], ['MC', 'Monaco', '🇲🇨'],
  ['MN', 'Mongolie', '🇲🇳'], ['ME', 'Monténégro', '🇲🇪'], ['MZ', 'Mozambique', '🇲🇿'],
  ['MM', 'Myanmar', '🇲🇲'], ['NA', 'Namibie', '🇳🇦'], ['NP', 'Népal', '🇳🇵'],
  ['NI', 'Nicaragua', '🇳🇮'], ['NE', 'Niger', '🇳🇪'], ['NG', 'Nigeria', '🇳🇬'],
  ['NO', 'Norvège', '🇳🇴'], ['NZ', 'Nouvelle-Zélande', '🇳🇿'], ['OM', 'Oman', '🇴🇲'],
  ['UG', 'Ouganda', '🇺🇬'], ['UZ', 'Ouzbékistan', '🇺🇿'], ['PK', 'Pakistan', '🇵🇰'],
  ['PA', 'Panama', '🇵🇦'], ['PY', 'Paraguay', '🇵🇾'], ['NL', 'Pays-Bas', '🇳🇱'],
  ['PE', 'Pérou', '🇵🇪'], ['PH', 'Philippines', '🇵🇭'], ['PL', 'Pologne', '🇵🇱'],
  ['PT', 'Portugal', '🇵🇹'], ['QA', 'Qatar', '🇶🇦'], ['RO', 'Roumanie', '🇷🇴'],
  ['GB', 'Royaume-Uni', '🇬🇧'], ['RU', 'Russie', '🇷🇺'], ['RW', 'Rwanda', '🇷🇼'],
  ['SN', 'Sénégal', '🇸🇳'], ['RS', 'Serbie', '🇷🇸'], ['SG', 'Singapour', '🇸🇬'],
  ['SK', 'Slovaquie', '🇸🇰'], ['SI', 'Slovénie', '🇸🇮'], ['SO', 'Somalie', '🇸🇴'],
  ['SD', 'Soudan', '🇸🇩'], ['LK', 'Sri Lanka', '🇱🇰'], ['SE', 'Suède', '🇸🇪'],
  ['CH', 'Suisse', '🇨🇭'], ['SR', 'Suriname', '🇸🇷'], ['SY', 'Syrie', '🇸🇾'],
  ['TJ', 'Tadjikistan', '🇹🇯'], ['TW', 'Taïwan', '🇹🇼'], ['TZ', 'Tanzanie', '🇹🇿'],
  ['TD', 'Tchad', '🇹🇩'], ['CZ', 'Tchéquie', '🇨🇿'], ['TH', 'Thaïlande', '🇹🇭'],
  ['TG', 'Togo', '🇹🇬'], ['TT', 'Trinité-et-Tobago', '🇹🇹'], ['TN', 'Tunisie', '🇹🇳'],
  ['TM', 'Turkménistan', '🇹🇲'], ['TR', 'Turquie', '🇹🇷'], ['UA', 'Ukraine', '🇺🇦'],
  ['UY', 'Uruguay', '🇺🇾'], ['VE', 'Venezuela', '🇻🇪'], ['VN', 'Viêt Nam', '🇻🇳'],
  ['YE', 'Yémen', '🇾🇪'], ['ZM', 'Zambie', '🇿🇲'], ['ZW', 'Zimbabwe', '🇿🇼'],
];

export const COUNTRIES: Country[] = RAW
  .map(([code, name, flag]) => ({ code, name, flag }))
  .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

export const findCountry = (code: string): Country | null =>
  COUNTRIES.find((c) => c.code === code) ?? null;
