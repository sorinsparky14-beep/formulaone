// Lights Out & Toe Away — Category Definitions + Grid Builder

const CATS = [
  // TEAMS
  {id:"ferrari",g:"team",label:"Drove for\nFerrari",img:IMG_TEAM_FERRARI,carImg:true,badge:"b-team",check:d=>d.teams.includes("ferrari")},
  {id:"mercedes",g:"team",label:"Drove for\nMercedes",img:IMG_TEAM_MERCEDES,carImg:true,badge:"b-team",check:d=>d.teams.includes("mercedes")},
  {id:"redbull",g:"team",label:"Drove for\nRed Bull",img:IMG_TEAM_REDBULL,carImg:true,badge:"b-team",check:d=>d.teams.includes("redbull")},
  {id:"mclaren",g:"team",label:"Drove for\nMcLaren",img:IMG_TEAM_MCLAREN,carImg:true,badge:"b-team",check:d=>d.teams.includes("mclaren")},
  {id:"williams",g:"team",label:"Drove for\nWilliams",img:IMG_TEAM_WILLIAMS,carImg:true,badge:"b-team",check:d=>d.teams.includes("williams")},
  {id:"renault",g:"team",label:"Drove for\nRenault",img:IMG_TEAM_RENAULT,carImg:true,badge:"b-team",check:d=>d.teams.some(t=>t.startsWith("renault"))},
  {id:"alpine",g:"team",label:"Drove for\nAlpine",img:IMG_TEAM_ALPINE,carImg:true,badge:"b-team",check:d=>d.teams.includes("alpine")},
  {id:"alphatauri",g:"team",label:"Drove for\nAlphaTauri/RB",img:IMG_TEAM_ALPHATAURI,carImg:true,badge:"b-team",check:d=>d.teams.some(t=>["alphatauri","toro rosso"].includes(t))},
  {id:"sauber",g:"team",label:"Drove for\nSauber/Alfa",img:IMG_TEAM_SAUBER,carImg:true,badge:"b-team",check:d=>d.teams.some(t=>["sauber","alfa romeo"].includes(t))},
  {id:"haas",g:"team",label:"Drove for\nHaas",img:IMG_TEAM_HAAS,carImg:true,badge:"b-team",check:d=>d.teams.includes("haas")},
  {id:"lotus",g:"team",label:"Drove for\nLotus",img:IMG_TEAM_LOTUS,carImg:true,badge:"b-team",check:d=>d.teams.some(t=>t.startsWith("lotus"))},
  {id:"jordan",g:"team",label:"Drove for\nJordan",img:IMG_TEAM_JORDAN,carImg:true,badge:"b-team",check:d=>d.teams.includes("jordan")},
  {id:"benetton",g:"team",label:"Drove for\nBenetton",img:IMG_TEAM_BENETTON,carImg:true,badge:"b-team",check:d=>d.teams.includes("benetton")},
  {id:"brabham",g:"team",label:"Drove for\nBrabham",img:IMG_TEAM_BRABHAM,carImg:true,badge:"b-team",check:d=>d.teams.includes("brabham")},
  {id:"tyrrell",g:"team",label:"Drove for\nTyrrell",img:IMG_TEAM_TYRRELL,carImg:true,badge:"b-team",check:d=>d.teams.includes("tyrrell")},
  {id:"brawn",g:"team",label:"Drove for\nBrawn GP",img:IMG_TEAM_BRAWN,carImg:true,badge:"b-team",check:d=>d.teams.includes("brawn")},
  {id:"force_india",g:"team",label:"Drove for\nForce India/RP",img:IMG_TEAM_FORCE_INDIA,carImg:true,badge:"b-team",check:d=>d.teams.some(t=>["force india","racing point"].includes(t))},
  {id:"bmw",g:"team",label:"Drove for\nBMW Sauber",img:IMG_TEAM_BMW,carImg:true,badge:"b-team",check:d=>d.teams.includes("bmw")},
  {id:"toyota",g:"team",label:"Drove for\nToyota",img:IMG_TEAM_TOYOTA,carImg:true,badge:"b-team",check:d=>d.teams.includes("toyota")},
  {id:"aston",g:"team",label:"Drove for\nAston Martin",img:IMG_TEAM_ASTON,carImg:true,badge:"b-team",check:d=>d.teams.includes("aston martin")},
  {id:"minardi",g:"team",label:"Drove for\nMinardi/HRT",img:IMG_TEAM_MINARDI,carImg:true,badge:"b-team",check:d=>d.teams.some(t=>["minardi","hrt"].includes(t))},
  // NATIONALITIES
  {id:"nat-brit",g:"nat",label:"British\nDriver",img:IMG_FLAG_BRITISH,flagImg:true,badge:"b-nat",check:d=>d.nat==="british"},
  {id:"nat-ger",g:"nat",label:"German\nDriver",img:IMG_FLAG_GERMAN,flagImg:true,badge:"b-nat",check:d=>d.nat==="german"},
  {id:"nat-bra",g:"nat",label:"Brazilian\nDriver",img:IMG_FLAG_BRAZILIAN,flagImg:true,badge:"b-nat",check:d=>d.nat==="brazilian"},
  {id:"nat-fin",g:"nat",label:"Finnish\nDriver",img:IMG_FLAG_FINNISH,flagImg:true,badge:"b-nat",check:d=>d.nat==="finnish"},
  {id:"nat-fra",g:"nat",label:"French\nDriver",img:IMG_FLAG_FRENCH,flagImg:true,badge:"b-nat",check:d=>d.nat==="french"},
  {id:"nat-ita",g:"nat",label:"Italian\nDriver",img:IMG_FLAG_ITALIAN,flagImg:true,badge:"b-nat",check:d=>d.nat==="italian"},
  {id:"nat-esp",g:"nat",label:"Spanish\nDriver",img:IMG_FLAG_SPANISH,flagImg:true,badge:"b-nat",check:d=>d.nat==="spanish"},
  {id:"nat-aus",g:"nat",label:"Australian\nDriver",img:IMG_FLAG_AUSTRALIAN,flagImg:true,badge:"b-nat",check:d=>d.nat==="australian"},
  {id:"nat-ned",g:"nat",label:"Dutch\nDriver",img:IMG_FLAG_DUTCH,flagImg:true,badge:"b-nat",check:d=>d.nat==="dutch"},
  {id:"nat-aut",g:"nat",label:"Austrian\nDriver",img:IMG_FLAG_AUSTRIAN,flagImg:true,badge:"b-nat",check:d=>d.nat==="austrian"},
  {id:"nat-can",g:"nat",label:"Canadian\nDriver",img:IMG_FLAG_CANADIAN,flagImg:true,badge:"b-nat",check:d=>d.nat==="canadian"},
  {id:"nat-mex",g:"nat",label:"Mexican\nDriver",img:IMG_FLAG_MEXICAN,flagImg:true,badge:"b-nat",check:d=>d.nat==="mexican"},
  {id:"nat-mon",g:"nat",label:"Monegasque\nDriver",img:IMG_FLAG_MONEGASQUE,flagImg:true,badge:"b-nat",check:d=>d.nat==="monegasque"},
  // TROPHIES
  {id:"champ",g:"trophy",label:"World\nChampion",img:IMG_WILD_CHAMPIONS,flagImg:true,badge:"b-troph",check:d=>d.champ},
  {id:"multi2",g:"trophy",label:"2+ World\nTitles",img:IMG_WILD_TITLES,flagImg:true,badge:"b-troph",check:d=>d.champN>=2},
  {id:"multi3",g:"trophy",label:"3+ World\nTitles",img:IMG_WILD_TITLES,flagImg:true,badge:"b-troph",check:d=>d.champN>=3},
  {id:"gpwin",g:"trophy",label:"GP Winner\n(1+ win)",img:IMG_WILD_RACE_WINS,flagImg:true,badge:"b-troph",check:d=>d.wins>=1},
  {id:"wins2",g:"trophy",label:"2+ Grand\nPrix Wins",img:IMG_WILD_RACE_WINS,flagImg:true,badge:"b-troph",check:d=>d.wins>=2},
  {id:"wins10",g:"trophy",label:"10+ Race\nWins",img:IMG_WILD_RACE_WINS,flagImg:true,badge:"b-troph",check:d=>d.wins>=10},
  {id:"wins25",g:"trophy",label:"25+ Race\nWins",img:IMG_WILD_RACE_WINS,flagImg:true,badge:"b-troph",check:d=>d.wins>=25},
  {id:"wins50",g:"trophy",label:"50+ Race\nWins",img:IMG_WILD_RACE_WINS,flagImg:true,badge:"b-troph",check:d=>d.wins>=50},
  {id:"gslam",g:"trophy",label:"Grand Slam\nWinner",img:IMG_ERA_GRAND_SLAM,flagImg:true,badge:"b-troph",check:d=>d.gSlam},
  {id:"fl5",g:"trophy",label:"5+ Career\nFastest Laps",img:IMG_WILD_FASTEST_LAP,flagImg:true,badge:"b-troph",check:d=>d.fastLaps>=5},
  {id:"fl20",g:"trophy",label:"20+ Career\nFastest Laps",img:IMG_WILD_FASTEST_LAP,flagImg:true,badge:"b-troph",check:d=>d.fastLaps>=20},
  // CIRCUITS
  {id:"c-monaco",g:"circuit",label:"Won at\nMonte-Carlo",img:IMG_CIRC_MONACO,flagImg:true,badge:"b-circ",check:d=>(d.circuits.monaco||0)>=1},
  {id:"c-monaco2",g:"circuit",label:"2+ Wins at\nMonte-Carlo",img:IMG_CIRC_MONACO,flagImg:true,badge:"b-circ",check:d=>(d.circuits.monaco||0)>=2},
  {id:"c-spa",g:"circuit",label:"Won at\nSpa-Francorchamps",img:IMG_CIRC_BELGIUM,flagImg:true,badge:"b-circ",check:d=>(d.circuits.spa||0)+(d.circuits.belgium||0)>=1},
  {id:"c-spa2",g:"circuit",label:"2+ Wins at\nSpa-Francorchamps",img:IMG_CIRC_BELGIUM,flagImg:true,badge:"b-circ",check:d=>(d.circuits.spa||0)+(d.circuits.belgium||0)>=2},
  {id:"c-monza",g:"circuit",label:"Won at\nMonza",img:IMG_CIRC_ITALY,flagImg:true,badge:"b-circ",check:d=>(d.circuits.monza||0)+(d.circuits.italy||0)>=1},
  {id:"c-suzuka",g:"circuit",label:"Won at\nSuzuka",img:IMG_CIRC_JAPAN,flagImg:true,badge:"b-circ",check:d=>(d.circuits.suzuka||0)+(d.circuits.japan||0)>=1},
  {id:"c-silver",g:"circuit",label:"Won at\nSilverstone",img:IMG_CIRC_GREAT_BRITAIN,flagImg:true,badge:"b-circ",check:d=>(d.circuits.silverstone||0)>=1},
  {id:"c-canada",g:"circuit",label:"Won at\nCircuit Gilles Villeneuve",img:IMG_CIRC_CANADA,flagImg:true,badge:"b-circ",check:d=>(d.circuits.canada||0)>=1},
  {id:"c-brazil",g:"circuit",label:"Won at\nInterlagos",img:IMG_CIRC_BRAZIL,flagImg:true,badge:"b-circ",check:d=>(d.circuits.brazil||0)+(d.circuits.interlagos||0)>=1},
  {id:"c-sg",g:"circuit",label:"Won at\nMarina Bay Street",img:IMG_CIRC_SINGAPORE,flagImg:true,badge:"b-circ",check:d=>(d.circuits.singapore||0)>=1},
  {id:"c-usa",g:"circuit",label:"Won at\nCircuit of the Americas",img:IMG_CIRC_USA,flagImg:true,badge:"b-circ",check:d=>(d.circuits.usa||0)>=1},
  {id:"c-ad",g:"circuit",label:"Won at\nYas Marina",img:IMG_CIRC_UAE,flagImg:true,badge:"b-circ",check:d=>(d.circuits.abu_dhabi||0)>=1},
  {id:"c-baku",g:"circuit",label:"Won at\nBaku City Circuit",img:IMG_CIRC_AZERBAIJAN,flagImg:true,badge:"b-circ",check:d=>(d.circuits.baku||0)+(d.circuits.azerbaijan||0)>=1},
  {id:"c-bahrain",g:"circuit",label:"Won at\nBahrain International",img:IMG_CIRC_BAHRAIN,flagImg:true,badge:"b-circ",check:d=>(d.circuits.bahrain||0)>=1},
  {id:"c-spain",g:"circuit",label:"Won at\nBarcelona-Catalunya",img:IMG_CIRC_SPAIN,flagImg:true,badge:"b-circ",check:d=>(d.circuits.spain||0)+(d.circuits.barcelona||0)>=1},
  {id:"c-zandvoort",g:"circuit",label:"Won at\nZandvoort",img:IMG_CIRC_NETHERLANDS,flagImg:true,badge:"b-circ",check:d=>(d.circuits.netherlands||0)>=1},
  {id:"c-austria",g:"circuit",label:"Won at\nRed Bull Ring",img:IMG_CIRC_AUSTRIA,flagImg:true,badge:"b-circ",check:d=>(d.circuits.austria||0)>=1},
  {id:"c-hungary",g:"circuit",label:"Won at\nHungaroring",img:IMG_CIRC_HUNGARY,flagImg:true,badge:"b-circ",check:d=>(d.circuits.hungary||0)+(d.circuits.budapest||0)>=1},
  {id:"c-aus",g:"circuit",label:"Won at\nAlbert Park",img:IMG_CIRC_AUSTRALIA,flagImg:true,badge:"b-circ",check:d=>(d.circuits.australia||0)>=1},
  {id:"c-malaysia",g:"circuit",label:"Won at\nSepang Circuit",img:IMG_CIRC_MALAYSIA,flagImg:true,badge:"b-circ",check:d=>(d.circuits.malaysia||0)>=1},
  {id:"c-hockenheim",g:"circuit",label:"Won at\nHockenheimring",img:IMG_CIRC_GERMANY_FLAG,flagImg:true,badge:"b-circ",check:d=>(d.circuits.hockenheim||0)>=1},
  {id:"c-nurburgring",g:"circuit",label:"Won at\nNürburgring",img:IMG_CIRC_GERMANY,flagImg:true,badge:"b-circ",check:d=>(d.circuits.nurburgring||0)>=1},
  {id:"c-estoril",g:"circuit",label:"Won at\nEstoril",img:IMG_CIRC_PORTUGAL,flagImg:true,badge:"b-circ",check:d=>(d.circuits.portugal||0)>=1},
  {id:"c-buenos_aires",g:"circuit",label:"Won at\nBuenos Aires",img:IMG_CIRC_ARGENTINA,flagImg:true,badge:"b-circ",check:d=>(d.circuits.argentina||0)>=1},
  {id:"c-shanghai",g:"circuit",label:"Won at\nShanghai",img:IMG_CIRC_CHINA,flagImg:true,badge:"b-circ",check:d=>(d.circuits.china||0)>=1},
  {id:"c-paul_ricard",g:"circuit",label:"Won at\nPaul Ricard",img:IMG_CIRC_FRANCE_FLAG,flagImg:true,badge:"b-circ",check:d=>(d.circuits.paul_ricard||0)>=1},
  {id:"c-kyalami",g:"circuit",label:"Won at\nKyalami",img:IMG_CIRC_SOUTH_AFRICA,flagImg:true,badge:"b-circ",check:d=>(d.circuits.south_africa||0)>=1},
  {id:"c-brands_hatch",g:"circuit",label:"Won at\nBrands Hatch",img:IMG_CIRC_GREAT_BRITAIN_FLAG,flagImg:true,badge:"b-circ",check:d=>(d.circuits.brands_hatch||0)>=1},
  {id:"c-watkins_glen",g:"circuit",label:"Won at\nWatkins Glen",img:IMG_CIRC_USA_FLAG,flagImg:true,badge:"b-circ",check:d=>(d.circuits.watkins_glen||0)>=1},
  {id:"c-france",g:"circuit",label:"Won at\nMagny-Cours",img:IMG_CIRC_FRANCE,flagImg:true,badge:"b-circ",check:d=>(d.circuits.magny_cours||0)>=1},
  // TEAM PRINCIPALS
  {id:"tp-brawn",g:"tp",label:"Under\nRoss Brawn",img:IMG_TP_ROSS_BRAWN,badge:"b-tp",check:d=>d.tps.includes("ross brawn")},
  {id:"tp-toto",g:"tp",label:"Under\nToto Wolff",img:IMG_TP_TOTO_WOLFF,badge:"b-tp",check:d=>d.tps.includes("toto wolff")},
  {id:"tp-horner",g:"tp",label:"Under\nChristian Horner",img:IMG_TP_CHRISTIAN_HORNER,badge:"b-tp",check:d=>d.tps.includes("christian horner")},
  {id:"tp-flavio",g:"tp",label:"Under\nFlavio Briatore",img:IMG_TP_FLAVIO_BRIATORE,badge:"b-tp",check:d=>d.tps.includes("flavio briatore")},
  {id:"tp-ron",g:"tp",label:"Under\nRon Dennis",img:IMG_TP_RON_DENNIS,badge:"b-tp",check:d=>d.tps.includes("ron dennis")},
  {id:"tp-frank",g:"tp",label:"Under\nFrank Williams",img:IMG_TP_FRANK_WILLIAMS,badge:"b-tp",check:d=>d.tps.includes("frank williams")},
  {id:"tp-fred",g:"tp",label:"Under\nFred Vasseur",img:IMG_TP_FREDERIC_VASSEUR,badge:"b-tp",check:d=>d.tps.includes("fred vasseur")},
  {id:"tp-eddiej",g:"tp",label:"Under\nEddie Jordan",img:IMG_TP_EDDIE_JORDAN,badge:"b-tp",check:d=>d.tps.includes("eddie jordan")},
  {id:"tp-todt",g:"tp",label:"Under\nJean Todt",img:IMG_TP_JEAN_TODT,badge:"b-tp",check:d=>d.tps.includes("jean todt")},
  {id:"tp-franz",g:"tp",label:"Under\nFranz Tost",img:IMG_TP_FRANZ_TOST,badge:"b-tp",check:d=>d.tps.includes("franz tost")},
  {id:"tp-chapman",g:"tp",label:"Under\nColin Chapman",img:IMG_TP_COLIN_CHAPMAN,badge:"b-tp",check:d=>d.tps.includes("colin chapman")},
  {id:"tp-guenther",g:"tp",label:"Under\nGuenther Steiner",img:IMG_TP_GUENTHER_STEINER,badge:"b-tp",check:d=>d.tps.includes("guenther steiner")},
  {id:"tp-zak",g:"tp",label:"Under\nZak Brown",img:IMG_TP_ZAK_BROWN,badge:"b-tp",check:d=>d.tps.includes("zak brown")},
  // WILDCARDS
  {id:"born-2000s",g:"wild",label:"Born in\nthe 2000s",img:IMG_BORN_2000S,flagImg:true,badge:"b-wild",check:d=>d.birthY>=2000},
  {id:"born-1990s",g:"wild",label:"Born in\nthe 1990s",img:IMG_BORN_1990S,flagImg:true,badge:"b-wild",check:d=>d.birthY>=1990&&d.birthY<2000},
  {id:"born-1980s",g:"wild",label:"Born in\nthe 1980s",img:IMG_BORN_1980S,flagImg:true,badge:"b-wild",check:d=>d.birthY>=1980&&d.birthY<1990},
  {id:"born-1970s",g:"wild",label:"Born in\nthe 1970s",img:IMG_BORN_1970S,flagImg:true,badge:"b-wild",check:d=>d.birthY>=1970&&d.birthY<1980},
  {id:"born-1960s",g:"wild",label:"Born in\nthe 1960s",img:IMG_BORN_1960S,flagImg:true,badge:"b-wild",check:d=>d.birthY>=1960&&d.birthY<1970},
  {id:"born-1950s",g:"wild",label:"Born in\nthe 1950s",img:IMG_BORN_1950S,flagImg:true,badge:"b-wild",check:d=>d.birthY>=1950&&d.birthY<1960},
  {id:"era1950_70",g:"wild",label:"Raced\n1950–1970",img:IMG_ERA_1950_70,flagImg:true,badge:"b-wild",check:d=>d.decades.some(x=>[1950,1960].includes(x))},
  {id:"era1970_80",g:"wild",label:"Raced\n1970–1980",img:IMG_ERA_1970_80,flagImg:true,badge:"b-wild",check:d=>d.decades.includes(1970)},
  {id:"era1980_90",g:"wild",label:"Raced\n1980–1990",img:IMG_ERA_1980_90,flagImg:true,badge:"b-wild",check:d=>d.decades.includes(1980)},
  {id:"era1990_00",g:"wild",label:"Raced\n1990–2000",img:IMG_ERA_1990_00,flagImg:true,badge:"b-wild",check:d=>d.decades.includes(1990)},
  {id:"era2000_10",g:"wild",label:"Raced\n2000–2010",img:IMG_ERA_2000_10,flagImg:true,badge:"b-wild",check:d=>d.decades.includes(2000)},
  {id:"era2010_20",g:"wild",label:"Raced\n2010–2020",img:IMG_ERA_2010_20,flagImg:true,badge:"b-wild",check:d=>d.decades.includes(2010)},
  {id:"era2020",g:"wild",label:"Active in\n2020s",img:IMG_ERA_ACTIVE2020,flagImg:true,badge:"b-wild",check:d=>d.decades.includes(2020)},
  {id:"t3",g:"wild",label:"Drove for\n3+ Teams",img:IMG_WILD_TEAMS,flagImg:true,badge:"b-wild",check:d=>d.teamN>=3},
  {id:"t4",g:"wild",label:"Drove for\n4+ Teams",img:IMG_WILD_TEAMS,flagImg:true,badge:"b-wild",check:d=>d.teamN>=4},
  {id:"t5",g:"wild",label:"Drove for\n5+ Teams",img:IMG_WILD_TEAMS,flagImg:true,badge:"b-wild",check:d=>d.teamN>=5},
  {id:"eu5",g:"wild",label:"Europe\n5+ Race Wins",img:IMG_CONT_EUROPE,flagImg:true,badge:"b-wild",check:d=>(d.contWins.eu||0)>=5},
  {id:"na2",g:"wild",label:"North America\n2+ Race Wins",img:IMG_CONT_NORTH_AMERICA,flagImg:true,badge:"b-wild",check:d=>(d.contWins.na||0)>=2},
  {id:"sa2",g:"wild",label:"South America\n2+ Race Wins",img:IMG_CONT_SOUTH_AMERICA,flagImg:true,badge:"b-wild",check:d=>(d.contWins.sa||0)>=2},
  {id:"as2",g:"wild",label:"Asia-Oceania\n2+ Race Wins",img:IMG_CONT_ASIA,flagImg:true,badge:"b-wild",check:d=>(d.contWins.as||0)>=(2)},
  {id:"cont3",g:"wild",label:"Global\n3+ Continents Won",img:IMG_CONT_WORLD,flagImg:true,badge:"b-wild",check:d=>{const c=d.contWins;return [c.eu,c.na,c.sa,c.as,c.oc,c.af].filter(v=>v>0).length>=3;}},
  {id:"top3t",g:"wild",label:"Raced in\n3+ Top Teams",img:IMG_WILD_TEAMS,flagImg:true,badge:"b-wild",check:d=>{const tops=["ferrari","mercedes","redbull","mclaren","williams","renault_mid"];return d.teams.filter(t=>tops.includes(t)).length>=3;}},
  {id:"wc2circ",g:"wild",label:"Wins at\n2+ Top 5 Circuits",img:IMG_WILD_CIRCUITS,flagImg:true,badge:"b-wild",check:d=>{const top5=["monaco","spa","belgium","suzuka","japan","monza","italy","silverstone","britain","interlagos","brazil"];return top5.filter(c=>(d.circuits[c]||0)>=1).length>=2;}},
  {id:"fl10",g:"wild",label:"10+ Career\nFastest Laps",img:IMG_WILD_FASTEST_LAP,flagImg:true,badge:"b-wild",check:d=>d.fastLaps>=10},
  // TEAMMATE PORTRAITS
  {id:"tm-senna",g:"tm",label:"Teammate\nof Senna",img:IMG_SENNA,badge:"b-tm",check:d=>{const n=d.name.toLowerCase();return ["derek warwick","gerhard berger","alain prost","nigel mansell","martin brundle","riccardo patrese","jean alesi","andrea de cesaris"].includes(n);}},
  {id:"tm-leclerc",g:"tm",label:"Teammate\nof Leclerc",img:IMG_LECLERC,badge:"b-tm",check:d=>["marcus ericsson","sebastian vettel","carlos sainz"].includes(d.name.toLowerCase())},
  {id:"tm-ricc",g:"tm",label:"Teammate\nof Ricciardo",img:IMG_RICCIARDO,badge:"b-tm",check:d=>{const n=d.name.toLowerCase();return ["mark webber","sebastian vettel","nico hülkenberg","kevin magnussen","lando norris","oscar piastri","pierre gasly","yuki tsunoda","daniil kvyat"].includes(n);}},
  {id:"tm-alonso",g:"tm",label:"Teammate\nof Alonso",img:IMG_ALONSO,badge:"b-tm",check:d=>{const n=d.name.toLowerCase();return ["jarno trulli","giancarlo fisichella","lewis hamilton","felipe massa","kimi räikkönen","jenson button","stoffel vandoorne","carlos sainz","esteban ocon","lance stroll"].includes(n);}},
  {id:"tm-ham",g:"tm",label:"Teammate\nof Hamilton",img:IMG_HAMILTON,badge:"b-tm",check:d=>{const n=d.name.toLowerCase();return ["fernando alonso","nico rosberg","valtteri bottas","george russell"].includes(n);}},
  {id:"tm-ver",g:"tm",label:"Teammate\nof Verstappen",img:IMG_VERSTAPPEN,badge:"b-tm",check:d=>{const n=d.name.toLowerCase();return ["carlos sainz","daniil kvyat","daniel ricciardo","pierre gasly","alex albon","sergio pérez","yuki tsunoda"].includes(n);}},
  {id:"tm-sch",g:"tm",label:"Teammate\nof Schumacher",img:IMG_SCHUMACHER,badge:"b-tm",check:d=>{const n=d.name.toLowerCase();return ["rubens barrichello","eddie irvine","nico rosberg","martin brundle","heinz-harald frentzen","damon hill","johnny herbert"].includes(n);}},
  {id:"tm-piq",g:"tm",label:"Teammate\nof Piquet",img:IMG_PIQUET,badge:"b-tm",check:d=>{const n=d.name.toLowerCase();return ["niki lauda","riccardo patrese","nigel mansell","derek warwick","martin brundle"].includes(n);}},
  {id:"tm-barr",g:"tm",label:"Teammate\nof Barrichello",img:IMG_BARRICHELLO,badge:"b-tm",check:d=>{const n=d.name.toLowerCase();return ["michael schumacher","jenson button","damon hill","eddie irvine","ralf schumacher"].includes(n);}},
  {id:"tm-vet",g:"tm",label:"Teammate\nof Vettel",img:IMG_VETTEL,badge:"b-tm",check:d=>{const n=d.name.toLowerCase();return ["mark webber","kimi räikkönen","charles leclerc","lance stroll","daniil kvyat"].includes(n);}},
];

// ── WIN CHECK ──────────────────────────────────────────────────────────────
const LINES=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function checkWin(board){
  for(const l of LINES){
    const [a,b,c]=l;
    if(board[a]&&board[b]&&board[c]&&board[a].p===board[b].p&&board[b].p===board[c].p)
      return{p:board[a].p,l};
  }
  if(board.every(c=>c!==null))return{p:"draw",l:[]};
  return null;
}

// ── GRID BUILDER ────────────────────────────────────────────────────────────
function countValid(a,b){return DB.filter(d=>a.check(d)&&b.check(d)).length;}
function buildGrid(){
  const cats=[...CATS];
  for(let t=0;t<1000;t++){
    const sh=[...cats].sort(()=>Math.random()-.5);
    const rows=sh.slice(0,3),cols=sh.slice(3,6);
    let ok=true;
    for(const r of rows){for(const c of cols){
      if(r.id===c.id||r.g===c.g){ok=false;break;}
      if(countValid(r,c)<2){ok=false;break;}
    }if(!ok)break;}
    if(ok)return{rows,cols};
  }
  return{rows:[CATS[0],CATS[20],CATS[33]],cols:[CATS[3],CATS[26],CATS[62]]};
}

// ── STATE ──────────────────────────────────────────────────────────────────
