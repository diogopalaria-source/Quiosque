import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import * as fs from 'fs';
import * as path from 'path';

// Load Firebase Config
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

const rawCSV = `Mês;Nome;Quantidade;Vendas;Categoria
2025 / out.;espresso origens pequeno;255;2295;Bebidas
2025 / out.;cookie triple chocolate;98;1617;Mr. Cheney
2025 / out.;cookie chocolate chips;87;1435,5;Mr. Cheney
2025 / out.;cookie my way;46;1127;Mr. Cheney
2025 / out.;tortas da bottega;62;992;Origens
2025 / out.;caixa 4 cookies;15;870;Mr. Cheney
2025 / out.;café latte pequeno;72;864;Bebidas
2025 / out.;cookie chocolate chips with m&ms;48;840;Mr. Cheney
2025 / out.;cookie double chocolate;48;792;Mr. Cheney
2025 / out.;croissant caprese;20;780;Origens
2025 / out.;cookie chocolate chips com macadâmia;45;742,5;Mr. Cheney
2025 / out.;novo cinnamon roll tradicional;28;686;Mr. Cheney
2025 / out.;espresso origens pequeno;75;675;Bebidas
2025 / out.;cappuccino tradicional;48;672;Bebidas
2025 / out.;água sem gás;101;656,5;Bebidas
2025 / out.;cookie red velvet;34;629;Mr. Cheney
2025 / out.;pão de queijo (3 unidades);59;590;Mr. Cheney
2025 / out.;café latte grande;41;574;Bebidas
2025 / out.;pão de queijo (6 unidades);32;544;Mr. Cheney
2025 / out.;white chocolate;30;495;Mr. Cheney
2025 / out.;cookie doce de leite;22;407;Mr. Cheney
2025 / out.;água com gás;41;307,5;Bebidas
2025 / out.;caixa 7 cookies;3;294;Mr. Cheney
2025 / out.;cheesecake;10;260;Mr. Cheney
2025 / out.;novo cinnamon roll especial;8;228;Mr. Cheney
2025 / out.;cookie ovomaltine;9;220,5;Mr. Cheney
2025 / out.;espresso macchiato pequeno;22;220;Bebidas
2025 / out.;croissant presunto e queijo;9;216;Origens
2025 / out.;chocolate quente pequeno;18;216;Bebidas
2025 / out.;brownie cookie;13;214,5;Mr. Cheney
2025 / out.;espresso origens grande;15;210;Bebidas
2025 / out.;clássico;14;196;Bebidas
2025 / out.;bolo caseiro;11;165;Origens
2025 / out.;cookie ice mountain;6;156;Mr. Cheney
2025 / out.;esfiha de carne;13;156;Origens
2025 / out.;croissant tradicional;8;152;Origens
2025 / out.;cookie pistache;6;147;Mr. Cheney
2025 / out.;pão com ovo;5;140;Origens
2025 / out.;novo cinnamon roll clássico;5;132,5;Mr. Cheney
2025 / out.;esfiha de queijo;11;132;Origens
2025 / out.;pão na chapa;13;130;Origens
2025 / out.;chá twinnigs;13;128,7;Bebidas
2025 / out.;cookie dark;5;122,5;Mr. Cheney
2025 / out.;cookie shake;4;120;Bebidas
2025 / out.;cappuccino dos chocólatras;7;119;Bebidas
2025 / out.;refrigerante 350ml;9;108,9;Bebidas
2025 / out.;suco natural;7;98;Bebidas
2025 / out.;pancakes 2 unidades;5;94,5;Mr. Cheney
2025 / out.;1 cookie + cafe ou chocolate;4;87,6;Mr. Cheney
2025 / out.;pão de queijo com batata doce e grãos;2;86;Origens
2025 / out.;pão na chapa com requeijão;5;85;Origens
2025 / out.;descafeinado;5;80;Bebidas
2025 / out.;refrigerante 220ml;10;79;Bebidas
2025 / out.;smoothie de fruta;4;76;Bebidas
2025 / out.;cookie brigadeirão;3;73,5;Mr. Cheney
2025 / out.;cookie bomb;3;73,5;Mr. Cheney
2025 / out.;chocolate cremoso grande;4;72;Bebidas
2025 / out.;moccha;4;68;Bebidas
2025 / out.;coxinha de batata doce com frango;4;68;Origens
2025 / out.;suco detox;4;64;Bebidas
2025 / out.;café mr cheney moído- 250 g;1;58,1;Origens
2025 / out.;espresso origens grande;4;56;Bebidas
2025 / out.;chocolate quente grande;4;56;Bebidas
2025 / out.;brownie chocolate;2;52;Mr. Cheney
2025 / out.;chá twinnigs;5;49,5;Bebidas
2025 / out.;suco natural com leite;3;48;Bebidas
2025 / out.;pancakes 3 unidades;2;45,8;Mr. Cheney
2025 / out.;espresso macchiato grande;3;42;Bebidas
2025 / out.;ice cappuccino;2;42;Bebidas
2025 / out.;2 estrelas - cookie + 1 expresso origens;2;35;Mr. Cheney
2025 / out.;chocolate gelado;3;33;Bebidas
2025 / out.;espresso com panna grande;2;32;Bebidas
2025 / out.;pão de queijo (3 unid) + café;2;32;Mr. Cheney
2025 / out.;chocolate quente com chantilly grande;2;32;Bebidas
2025 / out.;chocolate cremoso pequeno;2;30;Bebidas
2025 / out.;milk shake;1;28;Bebidas
2025 / out.;apple cobbler;1;26;Mr. Cheney
2025 / out.;mud frappe;1;25;Bebidas
2025 / out.;cookie avelã crunchy;1;24,5;Mr. Cheney
2025 / out.;cookie with fruits + nutella;1;24,04;Mr. Cheney
2025 / out.;espresso com panna pequeno;2;24;Bebidas
2025 / out.;tortinha caipira;1;22;Origens
2025 / out.;delícia detox;1;18;Bebidas
2025 / out.;white chocolate;1;16,5;Mr. Cheney
2025 / out.;creme de avela nutella 45 g;2;15,8;Porções
2025 / out.;soda americana;1;15;Bebidas
2025 / out.;chantilly 15 g;3;15;Porções
2025 / out.;ovos orgânicos cremosos;1;12;Origens
2025 / out.;leite integral 300ml;1;5,5;Porções
2025 / nov.;espresso origens pequeno;565;5085;Bebidas
2025 / nov.;cookie triple chocolate;269;4452,1;Mr. Cheney
2025 / nov.;cookie chocolate chips;181;2993,3;Mr. Cheney
2025 / nov.;cookie my way;121;2991,5;Mr. Cheney
2025 / nov.;cookie chocolate chips with m&ms;153;2681,5;Mr. Cheney
2025 / nov.;cookie double chocolate;137;2277,5;Mr. Cheney
2025 / nov.;tortas da bottega;137;2192;Origens
2025 / nov.;espresso origens pequeno;241;2169;Bebidas
2025 / nov.;água sem gás;333;2164,5;Bebidas
2025 / nov.;café latte pequeno;173;2076;Bebidas
2025 / nov.;cookie chocolate chips com macadâmia;122;2026,6;Mr. Cheney
2025 / nov.;novo cinnamon roll tradicional;80;1996;Mr. Cheney
2025 / nov.;cookie red velvet;96;1779,5;Mr. Cheney
2025 / nov.;white chocolate;96;1587,4;Mr. Cheney
2025 / nov.;caixa 7 cookies;14;1415;Mr. Cheney
2025 / nov.;caixa 4 cookies;21;1218;Mr. Cheney
2025 / nov.;cookie doce de leite;62;1147;Mr. Cheney
2025 / nov.;croissant caprese;29;1131;Origens
2025 / nov.;café latte grande;80;1120;Bebidas
2025 / nov.;cappuccino tradicional;78;1092;Bebidas
2025 / nov.;pão de queijo (6 unidades);60;1020;Mr. Cheney
2025 / nov.;brownie cookie;61;1006,5;Mr. Cheney
2025 / nov.;pão de queijo (3 unidades);89;890;Mr. Cheney
2025 / nov.;água com gás;117;877,5;Bebidas
2025 / nov.;bolo caseiro;57;855;Origens
2025 / nov.;cheesecake;25;650;Mr. Cheney
2025 / nov.;suco natural;41;574;Bebidas
2025 / nov.;croissant tradicional;29;551;Origens
2025 / nov.;cookie sandwich g;13;497,1;Mr. Cheney
2025 / nov.;clássico;34;476;Bebidas
2025 / nov.;1 cookie + cafe ou chocolate;21;459,9;Mr. Cheney
2025 / nov.;chocolate quente pequeno;38;456;Bebidas
2025 / nov.;cappuccino dos chocólatras;26;442;Bebidas
2025 / nov.;espresso macchiato pequeno;41;410;Bebidas
2025 / nov.;2 estrelas - cookie + 1 expresso origens;20;340;Mr. Cheney
2025 / nov.;caixa 12 cookies;2;330;Mr. Cheney
2025 / nov.;chá twinnigs;33;326,7;Bebidas
2025 / nov.;refrigerante 220ml;41;323,9;Bebidas
2025 / nov.;espresso origens grande;23;322;Bebidas
2025 / nov.;novo cinnamon roll clássico;12;318;Mr. Cheney
2025 / nov.;pancakes 2 unidades;16;302,4;Mr. Cheney
2025 / nov.;cookie pistache;12;294;Mr. Cheney
2025 / nov.;caixa 4 cookies;4;274;Mr. Cheney
2025 / nov.;esfiha de carne;22;274;Origens
2025 / nov.;esfiha de queijo;22;264;Origens
2025 / nov.;chocolate cremoso pequeno;17;255;Bebidas
2025 / nov.;refrigerante 350ml;25;247,5;Bebidas
2025 / nov.;pão de queijo (3 unid) + café;15;240;Mr. Cheney
2025 / nov.;cookie dark;9;231,3;Mr. Cheney
2025 / nov.;pão na chapa;22;220;Origens
2025 / nov.;descafeinado;13;208;Bebidas
2025 / nov.;espresso com panna grande;12;192;Bebidas
2025 / nov.;apple cobbler;7;188,9;Mr. Cheney
2025 / nov.;coxinha de batata doce com frango;11;187;Origens
2025 / nov.;3 estrelas - croissant recheado + suco natural com água;6;174;Origens
2025 / nov.;pancakes 2 unidades;6;174;Mr. Cheney
2025 / nov.;brownie chocolate;6;162,9;Mr. Cheney
2025 / nov.;cookie ice mountain;6;156;Mr. Cheney
2025 / nov.;pão com ovo;5;140;Origens
2025 / nov.;moccha;8;136;Bebidas
2025 / nov.;chocolate cremoso grande;7;126;Bebidas
2025 / nov.;espresso com panna pequeno;10;120;Bebidas
2025 / nov.;croissant presunto e queijo;5;120;Origens
2025 / nov.;smoothie de fruta;6;114;Bebidas
2025 / nov.;cookie avelã crunchy;4;108,8;Mr. Cheney
2025 / nov.;ice cappuccino;5;105;Bebidas
2025 / nov.;soda americana;7;105;Bebidas
2025 / nov.;novo cinnamon roll especial;3;85,5;Mr. Cheney
2025 / nov.;delícia de abacaxi;5;80;Bebidas
2025 / nov.;pão com carne suculenta;2;74;Origens
2025 / nov.;cookie ovomaltine;3;73,5;Mr. Cheney
2025 / nov.;espresso origens grande;5;70;Bebidas
2025 / nov.;leitinho da casa;5;70;Bebidas
2025 / nov.;pancakes 3 unidades;3;68,7;Mr. Cheney
2025 / nov.;chocolate gelado;6;66;Bebidas
2025 / nov.;chocolate quente com chantilly grande;4;64;Bebidas
2025 / nov.;maple 600 ml;1;58,1;Mr. Cheney
2025 / nov.;milk shake;2;56;Bebidas
2025 / nov.;suco lata (290ml);6;53,4;Bebidas
2025 / nov.;suco natural com leite;3;48;Bebidas
2025 / nov.;tortas da bottega;2;44;Origens
2025 / nov.;tortinha caipira;2;44;Origens
2025 / nov.;chocolate quente grande;3;42;Bebidas
2025 / nov.;espresso macchiato grande;3;42;Bebidas
2025 / nov.;chocolate quente com chantilly pequeno;3;42;Bebidas
2025 / nov.;chá twinnigs;4;39,6;Bebidas
2025 / nov.;novo cinnamon roll especial;1;36;Mr. Cheney
2025 / nov.;pão na chapa com requeijão;2;34;Origens
2025 / nov.;cookie shake;1;30;Bebidas
2025 / nov.;mud frappe;1;25;Bebidas
2025 / nov.;cookie bomb;1;24,5;Mr. Cheney
2025 / nov.;cookie brigadeirão;1;24,5;Mr. Cheney
2025 / nov.;coxinha vegana de batata doce com jaca;1;17;Origens
2025 / nov.;suco detox;1;16;Bebidas
2025 / nov.;ovos orgânicos cremosos;1;12;Origens
2025 / nov.;doce de leite 40 g;1;5,1;Porções
2025 / nov.;manteiga;1;4,5;Porções
2025 / nov.;leite zero lactose ou leite de aveia;1;4;Porções
2025 / nov.;manteiga 10 g;1;2,5;Porções
2025 / dez.;espresso origens pequeno;773;7571;Bebidas
2025 / dez.;cookie triple chocolate;234;4294,6;Mr. Cheney
2025 / dez.;cookie chocolate chips;232;4277,4;Mr. Cheney
2025 / dez.;água sem gás;487;3365,5;Bebidas
2025 / dez.;cookie chocolate chips with m&ms;169;3287,9;Mr. Cheney
2025 / dez.;cookie my way;110;2915,8;Mr. Cheney
2025 / dez.;café latte pequeno;222;2664;Bebidas
2025 / dez.;novo cinnamon roll tradicional;100;2649,5;Mr. Cheney
2025 / dez.;cookie double chocolate;132;2407;Mr. Cheney
2025 / dez.;tortas da bottega;135;2384;Origens
2025 / dez.;cookie red velvet;109;2302,4;Mr. Cheney
2025 / dez.;white chocolate;112;2065,6;Mr. Cheney
2025 / dez.;cookie chocolate chips com macadâmia;111;2043,9;Mr. Cheney
2025 / dez.;água com gás;209;1653;Bebidas
2025 / dez.;caixa 4 cookies;22;1409;Mr. Cheney
2025 / dez.;croissant caprese;36;1404;Origens
2025 / dez.;caixa 7 cookies;12;1334,8;Mr. Cheney
2025 / dez.;café latte grande;83;1296;Bebidas
2025 / dez.;pão de queijo (3 unidades);120;1290;Mr. Cheney
2025 / dez.;cappuccino tradicional;79;1234;Bebidas
2025 / dez.;cookie doce de leite;56;1185,8;Mr. Cheney
2025 / dez.;espresso origens pequeno;114;1102;Bebidas
2025 / dez.;pão de queijo (6 unidades);61;1089;Mr. Cheney
2025 / dez.;suco natural;67;938;Bebidas
2025 / dez.;cheesecake;33;918;Mr. Cheney
2025 / dez.;brownie cookie;49;890,1;Mr. Cheney
2025 / dez.;espresso origens grande;54;799;Bebidas
2025 / dez.;bolo caseiro;53;795;Origens
2025 / dez.;caixa 4 cookies;11;748,5;Mr. Cheney
2025 / dez.;1 cookie + cafe ou chocolate;30;657;Mr. Cheney
2025 / dez.;chá twinnigs;65;648,9;Bebidas
2025 / dez.;pancakes 2 unidades;28;567,2;Mr. Cheney
2025 / dez.;refrigerante 350ml;56;559;Bebidas
2025 / dez.;croissant tradicional;27;557;Origens
2025 / dez.;caixa 12 cookies;3;553;Mr. Cheney
2025 / dez.;dia do cookie 2025;66;544,5;Mr. Cheney
2025 / dez.;clássico;36;504;Bebidas
2025 / dez.;espresso macchiato pequeno;40;430;Bebidas
2025 / dez.;croissant presunto e queijo;17;420;Origens
2025 / dez.;2 estrelas - cookie + 1 expresso origens;22;404,4;Mr. Cheney
2025 / dez.;pão de queijo (3 unid) + café;25;400;Mr. Cheney
2025 / dez.;cookie ice mountain;14;392;Mr. Cheney
2025 / dez.;descafeinado;24;384;Bebidas
2025 / dez.;esfiha de queijo;31;377;Origens
2025 / dez.;refrigerante 220ml;47;375,2;Bebidas
2025 / dez.;cappuccino dos chocólatras;20;358;Bebidas
2025 / dez.;pão na chapa;34;340;Origens
2025 / dez.;cookie sandwich g;7;276,2;Mr. Cheney
2025 / dez.;brownie chocolate;10;274;Mr. Cheney
2025 / dez.;esfiha de carne;21;267;Origens
2025 / dez.;novo cinnamon roll especial;8;266,7;Mr. Cheney
2025 / dez.;cookie avelã crunchy;9;246,3;Mr. Cheney
2025 / dez.;cookie pistache;9;245,9;Mr. Cheney
2025 / dez.;chocolate quente pequeno;20;240;Bebidas
2025 / dez.;espresso com panna pequeno;19;228;Bebidas
2025 / dez.;smoothie de fruta;11;209;Bebidas
2025 / dez.;apple cobbler;7;200,9;Mr. Cheney
2025 / dez.;pão na chapa com requeijão;11;187;Origens
2025 / dez.;pão com carne suculenta;5;185;Origens
2025 / dez.;chocolate quente grande;12;168;Bebidas
2025 / dez.;cookie dark;6;159,5;Mr. Cheney
2025 / dez.;milk shake;5;155;Bebidas
2025 / dez.;ice cappuccino;7;150,5;Bebidas
2025 / dez.;pancakes 3 unidades;6;146,8;Mr. Cheney
2025 / dez.;suco natural com leite;9;144;Bebidas
2025 / dez.;delícia de abacaxi;8;128;Bebidas
2025 / dez.;cookie shake;4;128;Bebidas
2025 / dez.;big cookie;1;124;Mr. Cheney
2025 / dez.;soda americana;7;113;Bebidas
2025 / dez.;suco detox;7;112;Bebidas
2025 / dez.;coxinha de batata doce com frango;7;112;Origens
2025 / dez.;cookie ovomaltine;4;108;Mr. Cheney
2025 / dez.;chocolate cremoso pequeno;7;105;Bebidas
2025 / dez.;chocolate gelado;9;99;Bebidas
2025 / dez.;pão com ovo;3;84;Origens
2025 / dez.;frappé de café;3;84;Bebidas
2025 / dez.;cookie bomb;3;81;Mr. Cheney
2025 / dez.;crie seu milk shake;2;66;Bebidas
2025 / dez.;espresso com panna grande;4;64;Bebidas
2025 / dez.;3 estrelas - croissant recheado + suco natural com água;2;64;Origens
2025 / dez.;novo cinnamon roll clássico;2;63,1;Mr. Cheney
2025 / dez.;pancakes 2 unidades;2;52;Mr. Cheney
2025 / dez.;coxinha vegana de batata doce com jaca;3;51;Origens
2025 / dez.;espresso macchiato grande;3;44;Bebidas
2025 / dez.;leitinho da casa;3;42;Bebidas
2025 / dez.;chocolate cremoso grande;2;36;Bebidas
2025 / dez.;espresso origens grande;2;29;Bebidas
2025 / dez.;tortinha caipira;1;22;Origens
2025 / dez.;delícia detox;1;18;Bebidas
2025 / dez.;suco lata (290ml);2;18;Bebidas
2025 / dez.;moccha;1;17;Bebidas
2025 / dez.;chantilly 15 g;3;15;Porções
2025 / dez.;pão de queijo com batata doce e grãos;1;12;Origens
2025 / dez.;pão de queijo (3 unidades);1;12;Mr. Cheney
2025 / dez.;maple 65 g;2;11,4;Porções
2025 / dez.;chá twinnigs;1;9,9;Bebidas
2025 / dez.;creme de avela nutella 45 g;1;7,9;Porções
2025 / dez.;leite integral 300ml;1;5,5;Porções
2026 / jan.;espresso origens pequeno;632;6320;Bebidas
2026 / jan.;cookie chocolate chips;195;3701,5;Mr. Cheney
2026 / jan.;cookie triple chocolate;187;3543,3;Mr. Cheney
2026 / jan.;cookie my way;123;3355,8;Mr. Cheney
2026 / jan.;cookie chocolate chips with m&ms;155;3086,1;Mr. Cheney
2026 / jan.;novo cinnamon roll tradicional;113;3058;Mr. Cheney
2026 / jan.;cookie double chocolate;127;2411,3;Mr. Cheney
2026 / jan.;café latte pequeno;193;2316;Bebidas
2026 / jan.;cookie red velvet;93;2037,4;Mr. Cheney
2026 / jan.;água sem gás;285;1995;Bebidas
2026 / jan.;white chocolate;94;1781,6;Mr. Cheney
2026 / jan.;croissant caprese;45;1755;Origens
2026 / jan.;cookie chocolate chips com macadâmia;87;1646,3;Mr. Cheney
2026 / jan.;caixa 7 cookies;14;1609,9;Mr. Cheney
2026 / jan.;tortas da bottega;67;1206;Origens
2026 / jan.;café latte grande;68;1088;Bebidas
2026 / jan.;brownie cookie;48;911,2;Mr. Cheney
2026 / jan.;água com gás;113;904;Bebidas
2026 / jan.;cookie doce de leite;41;898,3;Mr. Cheney
2026 / jan.;pão de queijo (6 unidades);49;882;Mr. Cheney
2026 / jan.;cappuccino tradicional;55;880;Bebidas
2026 / jan.;clássico;61;854;Bebidas
2026 / jan.;pão de queijo (3 unidades);75;825;Mr. Cheney
2026 / jan.;caixa 4 cookies;12;780;Mr. Cheney
2026 / jan.;caixa 4 cookies;11;760,5;Mr. Cheney
2026 / jan.;croissant tradicional;34;714;Origens
2026 / jan.;cheesecake;23;644;Mr. Cheney
2026 / jan.;espresso origens grande;38;570;Bebidas
2026 / jan.;suco natural;40;560;Bebidas
2026 / jan.;cappuccino dos chocólatras;31;558;Bebidas
2026 / jan.;pancakes 2 unidades;23;480,7;Mr. Cheney
2026 / jan.;chá twinnigs;45;450;Bebidas
2026 / jan.;bolo caseiro;28;420;Origens
2026 / jan.;espresso macchiato pequeno;37;407;Bebidas
2026 / jan.;refrigerante 350ml;39;389,9;Bebidas
2026 / jan.;novo cinnamon roll clássico;12;369,2;Mr. Cheney
2026 / jan.;1 cookie + cafe ou chocolate;16;350,4;Mr. Cheney
2026 / jan.;croissant presunto e queijo;14;350;Origens
2026 / jan.;pão na chapa;35;350;Origens
2026 / jan.;cookie ice mountain;11;308;Mr. Cheney
2026 / jan.;brownie chocolate;11;308;Mr. Cheney
2026 / jan.;descafeinado;19;304;Bebidas
2026 / jan.;cookie avelã crunchy;10;284,5;Mr. Cheney
2026 / jan.;cookie bomb;10;278,7;Mr. Cheney
2026 / jan.;esfiha de queijo;19;228;Origens
2026 / jan.;2 estrelas - cookie + 1 expresso origens;12;226,8;Mr. Cheney
2026 / jan.;cookie pistache;8;218,9;Mr. Cheney
2026 / jan.;caixa 12 cookies;1;199;Mr. Cheney
2026 / jan.;refrigerante 220ml;24;192;Bebidas
2026 / jan.;pão com carne suculenta;5;185;Origens
2026 / jan.;apple cobbler;6;182,7;Mr. Cheney
2026 / jan.;novo cinnamon roll especial;5;175,4;Mr. Cheney
2026 / jan.;cookie ovomaltine;6;170,7;Mr. Cheney
2026 / jan.;big cookie namorados;1;159;Mr. Cheney
2026 / jan.;chocolate gelado;14;154;Bebidas
2026 / jan.;ice cappuccino;7;150,5;Bebidas
2026 / jan.;esfiha de carne;12;144;Origens
2026 / jan.;coxinha de batata doce com frango;8;128;Origens
2026 / jan.;cookie shake;4;128;Bebidas
2026 / jan.;suco natural com leite;8;128;Bebidas
2026 / jan.;espresso com panna pequeno;10;120;Bebidas
2026 / jan.;cookie sandwich g;3;119,9;Mr. Cheney
2026 / jan.;soda americana;7;119;Bebidas
2026 / jan.;coxinha vegana de batata doce com jaca;7;119;Origens
2026 / jan.;caixa 4 cinnamon rolls especiais;1;112,2;Mr. Cheney
2026 / jan.;pão de queijo (3 unid) + café;7;112;Mr. Cheney
2026 / jan.;pão com ovo;4;112;Origens
2026 / jan.;mix pancake 400g;2;109,4;Mr. Cheney
2026 / jan.;cookie dark;4;108;Mr. Cheney
2026 / jan.;caixa 4 cinnamon rolls tradicionais;1;99;Mr. Cheney
2026 / jan.;suco lata (290ml);11;99;Bebidas
2026 / jan.;delícia de abacaxi;6;96;Bebidas
2026 / jan.;espresso macchiato grande;6;90;Bebidas
2026 / jan.;pão na chapa com requeijão;5;85;Origens
2026 / jan.;chocolate quente pequeno;7;84;Bebidas
2026 / jan.;chocolate cremoso pequeno;5;75;Bebidas
2026 / jan.;pancakes 3 unidades;3;72;Mr. Cheney
2026 / jan.;espresso origens pequeno;7;70;Bebidas
2026 / jan.;tortinha caipira;3;66;Origens
2026 / jan.;milk shake;2;62;Bebidas
2026 / jan.;smoothie de fruta;3;57;Bebidas
2026 / jan.;frappé de café;2;56;Bebidas
2026 / jan.;3 estrelas - croissant recheado + suco natural com água;2;50;Origens
2026 / jan.;suco detox;3;48;Bebidas
2026 / jan.;2 estrelas - croissant recheado + suco natural com água;1;46;Origens
2026 / jan.;pão de queijo com batata doce e grãos;3;44;Origens
2026 / jan.;chocolate quente grande;3;42;Bebidas
2026 / jan.;leitinho da casa;3;42;Bebidas
2026 / jan.;moccha;2;36;Bebidas
2026 / jan.;delícia detox;2;36;Bebidas
2026 / jan.;crie seu milk shake;1;33;Bebidas
2026 / jan.;pancakes 2 unidades;1;29;Mr. Cheney
2026 / jan.;mud frappe;1;28;Bebidas
2026 / jan.;ovos orgânicos cremosos;2;24;Origens
2026 / jan.;tortas da bottega;1;22;Origens
2026 / jan.;chocolate cremoso grande;1;18;Bebidas
2026 / jan.;refrigerante 350ml;2;16;Bebidas
2026 / jan.;espresso com panna grande;1;16;Bebidas
2026 / jan.;espresso origens grande;1;15;Bebidas
2026 / jan.;chocolate quente com chantilly pequeno;1;14;Bebidas
2026 / jan.;pão de queijo (3 unidades);1;12;Mr. Cheney
2026 / jan.;refrigerante 350ml;1;9,5;Bebidas
2026 / jan.;porção de sorvete 80 g;1;8,5;Porções
2026 / jan.;cream cheese;1;5;Porções
2026 / jan.;manteiga;1;4,5;Porções
2026 / fev.;espresso origens pequeno;444;4440;Bebidas
2026 / fev.;cookie chocolate chips;157;2967,3;Mr. Cheney
2026 / fev.;novo cinnamon roll tradicional;99;2701;Mr. Cheney
2026 / fev.;cookie triple chocolate;135;2567,5;Mr. Cheney
2026 / fev.;cookie chocolate chips with m&ms;120;2388;Mr. Cheney
2026 / fev.;cookie double chocolate;102;1933,8;Mr. Cheney
2026 / fev.;cookie my way;68;1850,5;Mr. Cheney
2026 / fev.;café latte pequeno;130;1560;Bebidas
2026 / fev.;água sem gás;219;1533;Bebidas
2026 / fev.;cookie chocolate chips com macadâmia;71;1346,9;Mr. Cheney
2026 / fev.;white chocolate;71;1344,9;Mr. Cheney
2026 / fev.;caixa 4 cookies;19;1235;Mr. Cheney
2026 / fev.;cookie red velvet;48;1051,7;Mr. Cheney
2026 / fev.;croissant caprese;26;1014;Origens
2026 / fev.;café latte grande;53;848;Bebidas
2026 / fev.;cappuccino tradicional;47;752;Bebidas
2026 / fev.;água com gás;88;704;Bebidas
2026 / fev.;tortas da bottega;38;684;Origens
2026 / fev.;brownie cookie;35;665,5;Mr. Cheney
2026 / fev.;pão de queijo (6 unidades);35;630;Mr. Cheney
2026 / fev.;cookie doce de leite;25;547,6;Mr. Cheney
2026 / fev.;clássico;37;518;Bebidas
2026 / fev.;espresso origens grande;34;510;Bebidas
2026 / fev.;caixa 4 cookies;7;476,5;Mr. Cheney
2026 / fev.;cheesecake;17;476;Mr. Cheney
2026 / fev.;caixa 7 cookies;4;473,9;Mr. Cheney
2026 / fev.;pão de queijo (3 unidades);42;462;Mr. Cheney
2026 / fev.;cappuccino dos chocólatras;23;414;Bebidas
2026 / fev.;caixa 12 cookies;2;394;Mr. Cheney
2026 / fev.;suco natural;27;378;Bebidas
2026 / fev.;1 cookie + cafe ou chocolate;17;372,3;Mr. Cheney
2026 / fev.;chá twinnigs;37;370;Bebidas
2026 / fev.;cookie pistache;13;353,9;Mr. Cheney
2026 / fev.;espresso macchiato pequeno;32;352;Bebidas
2026 / fev.;bolo caseiro;20;300;Origens
2026 / fev.;descafeinado;16;256;Bebidas
2026 / fev.;refrigerante 350ml;25;249,6;Bebidas
2026 / fev.;2 estrelas - cookie + 1 expresso origens;12;232,8;Mr. Cheney
2026 / fev.;pão com carne suculenta;6;222;Origens
2026 / fev.;coxinha de batata doce com frango;12;198;Origens
2026 / fev.;cookie bomb;7;194,8;Mr. Cheney
2026 / fev.;esfiha de carne;16;192;Origens
2026 / fev.;esfiha de queijo;16;192;Origens
2026 / fev.;cookie avelã crunchy;7;191,9;Mr. Cheney
2026 / fev.;cookie ovomaltine;7;191,9;Mr. Cheney
2026 / fev.;loj2 - café + cookie clássico;10;189;Mr. Cheney
2026 / fev.;pancakes 2 unidades;9;188,1;Mr. Cheney
2026 / fev.;loj1 - café + 3 pães de queijo;11;176;Mr. Cheney
2026 / fev.;croissant presunto e queijo;7;175;Origens
2026 / fev.;ice cappuccino;8;172;Bebidas
2026 / fev.;cookie ice mountain;6;168;Mr. Cheney
2026 / fev.;refrigerante 220ml;21;168;Bebidas
2026 / fev.;novo cinnamon roll especial;5;166,2;Mr. Cheney
2026 / fev.;pão na chapa;16;160;Origens
2026 / fev.;novo cinnamon roll clássico;5;150,7;Mr. Cheney
2026 / fev.;cookie day after;15;142,75;Mr. Cheney
2026 / fev.;apple cobbler;5;140;Mr. Cheney
2026 / fev.;cookie with fruits + nutella;5;135;Mr. Cheney
2026 / fev.;cookie brigadeirão;5;135;Mr. Cheney
2026 / fev.;chocolate cremoso pequeno;8;120;Bebidas
2026 / fev.;brownie chocolate;4;112;Mr. Cheney
2026 / fev.;cookie dark;4;108;Mr. Cheney
2026 / fev.;chocolate quente pequeno;9;108;Bebidas
2026 / fev.;croissant tradicional;5;105;Origens
2026 / fev.;soda americana;6;102;Bebidas
2026 / fev.;cookie shake;3;96;Bebidas
2026 / fev.;smoothie de fruta;5;95;Bebidas
2026 / fev.;mud frappe;3;84;Bebidas
2026 / fev.;delícia de abacaxi;5;80;Bebidas
2026 / fev.;pão de queijo (3 unid) + café;5;80;Mr. Cheney
2026 / fev.;chocolate cremoso grande;4;72;Bebidas
2026 / fev.;coxinha vegana de batata doce com jaca;4;68;Origens
2026 / fev.;tortinha caipira;3;66;Origens
2026 / fev.;espresso com panna grande;4;64;Bebidas
2026 / fev.;pão com ovo;2;56;Origens
2026 / fev.;chocolate quente grande;4;56;Bebidas
2026 / fev.;pão de queijo com batata doce e grãos;3;52;Origens
2026 / fev.;pancakes 3 unidades;2;48;Mr. Cheney
2026 / fev.;loj6 - café + pão na chapa;3;47,7;Origens
2026 / fev.;2 estrelas - croissant recheado + suco natural com água;1;46;Origens
2026 / fev.;chocolate gelado;4;44;Bebidas
2026 / fev.;cookie sandwich g;1;38;Mr. Cheney
2026 / fev.;espresso com panna pequeno;3;36;Bebidas
2026 / fev.;pão na chapa com requeijão;2;34;Origens
2026 / fev.;crie seu milk shake;1;33;Bebidas
2026 / fev.;espresso macchiato grande;2;30;Bebidas
2026 / fev.;chocolate quente com chantilly pequeno;2;28;Bebidas
2026 / fev.;leitinho da casa;2;28;Bebidas
2026 / fev.;3 estrelas - croissant recheado + suco natural com água;1;25;Origens
2026 / fev.;loj3 - café + croissant tradicional;1;24;Origens
2026 / fev.;espresso origens pequeno;2;20;Bebidas
2026 / fev.;refrigerante 350ml;2;19,8;Bebidas
2026 / fev.;pastel assado;1;19;Origens
2026 / fev.;suco lata (290ml);2;18;Bebidas
2026 / fev.;delícia detox;1;18;Bebidas
2026 / fev.;moccha;1;18;Bebidas
2026 / fev.;yuba;1;18;Mr. Cheney
2026 / fev.;suco natural com leite;1;16;Bebidas
2026 / fev.;suco detox;1;16;Bebidas
2026 / fev.;cookie my way - day after;1;13,5;Mr. Cheney
2026 / fev.;waffle de queijo mr. cheney;1;12;Mr. Cheney
2026 / fev.;maple 65 g;2;11,4;Porções
2026 / fev.;refrigerante 220ml;1;8;Bebidas
2026 / fev.;leite integral 300ml;1;5,5;Porções
2026 / mar.;chantilly 15 g;1;5;Porções
2026 / mar.;espresso origens pequeno;588;5880;Bebidas
2026 / mar.;café latte pequeno;230;2760;Bebidas
2026 / mar.;cookie triple chocolate;140;2686,55;Mr. Cheney
2026 / mar.;cookie chocolate chips;137;2609,2;Mr. Cheney
2026 / mar.;novo cinnamon roll tradicional;92;2515,6;Mr. Cheney
2026 / mar.;cookie chocolate chips with m&ms;117;2331,5;Mr. Cheney
2026 / mar.;caixa 7 cookies;18;2163,4;Mr. Cheney
2026 / mar.;água sem gás;244;1708;Bebidas
2026 / mar.;cookie double chocolate;79;1498,1;Mr. Cheney
2026 / mar.;cookie chocolate chips com macadâmia;77;1470,3;Mr. Cheney
2026 / mar.;white chocolate;72;1373,8;Mr. Cheney
2026 / mar.;caixa 4 cookies;20;1300;Mr. Cheney
2026 / mar.;cookie my way;39;1098,2;Mr. Cheney
2026 / mar.;tortas da bottega;57;1026;Origens
2026 / mar.;cookie doce de leite;46;1018;Mr. Cheney
2026 / mar.;cookie red velvet;45;985,7;Mr. Cheney
2026 / mar.;café latte grande;56;896;Bebidas
2026 / mar.;caixa 4 cookies;11;820,9;Mr. Cheney
2026 / mar.;cookie day after;81;781,45;Mr. Cheney
2026 / mar.;croissant caprese;20;780;Origens
2026 / mar.;água com gás;95;760;Bebidas
2026 / mar.;cappuccino tradicional;39;624;Bebidas
2026 / mar.;espresso origens grande;39;585;Bebidas
2026 / mar.;cookie bomb;20;582,4;Mr. Cheney
2026 / mar.;pão de queijo (6 unidades);32;576;Mr. Cheney
2026 / mar.;loj1 - café + 3 pães de queijo;34;544;Mr. Cheney
2026 / mar.;ovo cookie loja;18;540;Mr. Cheney
2026 / mar.;loj2 - café + cookie clássico;26;491,4;Mr. Cheney
2026 / mar.;brownie cookie;25;482,5;Mr. Cheney
2026 / mar.;chá twinnigs;43;430;Bebidas
2026 / mar.;pão de queijo (3 unidades);39;429;Mr. Cheney
2026 / mar.;cookie sandwich g;10;421,4;Mr. Cheney
2026 / mar.;cheesecake;15;420;Mr. Cheney
2026 / mar.;espresso macchiato pequeno;37;407;Bebidas
2026 / mar.;cookie pistache;14;391,7;Mr. Cheney
2026 / mar.;refrigerante 350ml;37;370;Bebidas
2026 / mar.;cappuccino dos chocólatras;19;342;Bebidas
2026 / mar.;croissant tradicional;16;336;Origens
2026 / mar.;2 estrelas - cookie + 1 expresso origens;17;333,3;Mr. Cheney
2026 / mar.;1 cookie + cafe ou chocolate;15;328,5;Mr. Cheney
2026 / mar.;clássico;23;322;Bebidas
2026 / mar.;bolo caseiro;21;315;Origens
2026 / mar.;refrigerante 220ml;36;288;Bebidas
2026 / mar.;apple cobbler;9;277,6;Mr. Cheney
2026 / mar.;pancakes 2 unidades;13;271,7;Mr. Cheney
2026 / mar.;pão de queijo (3 unid) + café;16;256;Mr. Cheney
2026 / mar.;esfiha de carne;18;216;Origens
2026 / mar.;suco natural;15;210;Bebidas
2026 / mar.;descafeinado;12;192;Bebidas
2026 / mar.;caixa 12 cookies;1;189;Mr. Cheney
2026 / mar.;pastel assado;9;171;Origens
2026 / mar.;brownie chocolate;6;168;Mr. Cheney
2026 / mar.;cookie ovomaltine;6;167,8;Mr. Cheney
2026 / mar.;cookie dark;6;167;Mr. Cheney
2026 / mar.;cookie pao de mel;6;162;Mr. Cheney
2026 / mar.;cookie my way - day after;12;162;Mr. Cheney
2026 / mar.;cookie with fruits + nutella;6;162;Mr. Cheney
2026 / mar.;loj6 - café + pão na chapa;10;159;Origens
2026 / mar.;croissant presunto e queijo;6;150;Origens
2026 / mar.;cookie avelã crunchy;5;135;Mr. Cheney
2026 / mar.;crie seu milk shake;4;132;Bebidas
2026 / mar.;pão na chapa;13;130;Origens
2026 / mar.;coxinha de batata doce com frango;8;128;Origens
2026 / mar.;esfiha de queijo;10;120;Origens
2026 / mar.;waffle de queijo mr. cheney;10;120;Mr. Cheney
2026 / mar.;café mr cheney moído- 250 g;2;116,2;Origens
2026 / mar.;cookie ice mountain;4;112;Mr. Cheney
2026 / mar.;chocolate quente pequeno;8;96;Bebidas
2026 / mar.;cookie shake;3;96;Bebidas
2026 / mar.;ovo cookie loja;3;90;Mr. Cheney
2026 / mar.;yuba;5;90;Mr. Cheney
2026 / mar.;moccha;5;90;Bebidas
2026 / mar.;soda americana;5;85;Bebidas
2026 / mar.;pão com ovo;3;84;Origens
2026 / mar.;suco lata (290ml);9;81;Bebidas
2026 / mar.;loj3 - café + croissant tradicional;3;72;Origens
2026 / mar.;chocolate cremoso grande;4;72;Bebidas
2026 / mar.;chocolate quente grande;5;70;Bebidas
2026 / mar.;loj7 - café + pão com requeijão;3;63;Origens
2026 / mar.;novo cinnamon roll especial;2;62,8;Mr. Cheney
2026 / mar.;espresso macchiato grande;4;60;Bebidas
2026 / mar.;novo cinnamon roll clássico;2;58,4;Mr. Cheney
2026 / mar.;smoothie de fruta;3;57;Bebidas
2026 / mar.;pancakes 2 unidades;2;57;Mr. Cheney
2026 / mar.;frappé de café;2;56;Bebidas
2026 / mar.;mud frappe;2;56;Bebidas
2026 / mar.;chocolate gelado;5;55;Bebidas
2026 / mar.;cookie brigadeirão;2;54;Mr. Cheney
2026 / mar.;cookie cenoura com chocolate;2;54;Mr. Cheney
2026 / mar.;pão na chapa com requeijão;3;51;Origens
2026 / mar.;leitinho da casa;3;42;Bebidas
2026 / mar.;ovos orgânicos cremosos;3;36;Origens
2026 / mar.;milk shake;1;31;Bebidas
2026 / mar.;chocolate cremoso pequeno;2;30;Bebidas
2026 / mar.;ovo cookie loja;1;30;Mr. Cheney
2026 / mar.;3 estrelas - croissant recheado + suco natural com água;1;25;Origens
2026 / mar.;tortas da bottega;1;24,9;Origens
2026 / mar.;espresso com panna pequeno;2;24;Bebidas
2026 / mar.;ice cappuccino;1;21,5;Bebidas
2026 / mar.;espresso origens pequeno;2;20;Bebidas
2026 / mar.;chocolate quente com chantilly grande;1;17;Bebidas
2026 / mar.;creme de avela nutella 45 g;2;15,8;Porções
2026 / mar.;espresso origens grande;1;15;Bebidas
2026 / mar.;chocolate quente com chantilly pequeno;1;14;Bebidas
2026 / mar.;refrigerante 220ml;1;9,5;Bebidas
2026 / mar.;creme de leite ninho;1;8;Porções
2026 / mar.;manteiga;1;4,5;Porções
2026 / mar.;porção requeijão 35 g;1;4,2;Porções
2026 / abr.;espresso origens pequeno;574;5740;Bebidas
2026 / abr.;cookie triple chocolate;146;2821,95;Mr. Cheney
2026 / abr.;cookie chocolate chips;141;2712,9;Mr. Cheney
2026 / abr.;café latte pequeno;213;2556;Bebidas
2026 / abr.;novo cinnamon roll tradicional;82;2262,7;Mr. Cheney
2026 / abr.;cookie chocolate chips with m&ms;113;2260,9;Mr. Cheney
2026 / abr.;white chocolate;88;1705,2;Mr. Cheney
2026 / abr.;água sem gás;241;1687;Bebidas
2026 / abr.;caixa 4 cookies;25;1625;Mr. Cheney
2026 / abr.;cookie double chocolate;85;1612,5;Mr. Cheney
2026 / abr.;caixa 7 cookies;12;1582,8;Mr. Cheney
2026 / abr.;croissant caprese;28;1092;Origens
2026 / abr.;cookie red velvet;44;989,1;Mr. Cheney
2026 / abr.;cookie doce de leite;43;982,5;Mr. Cheney
2026 / abr.;cookie my way;36;982;Mr. Cheney
2026 / abr.;tortas da bottega;43;774;Origens
2026 / abr.;café latte grande;48;768;Bebidas
2026 / abr.;cappuccino tradicional;46;736;Bebidas
2026 / abr.;bolo caseiro;45;675;Origens
2026 / abr.;croissant presunto e queijo;27;674;Origens
2026 / abr.;pão de queijo (3 unidades);59;649;Mr. Cheney
2026 / abr.;água com gás;80;640;Bebidas
2026 / abr.;brownie cookie;32;622,8;Mr. Cheney
2026 / abr.;pancakes 2 unidades;29;606,1;Mr. Cheney
2026 / abr.;espresso origens grande;38;570;Bebidas
2026 / abr.;pão de queijo (6 unidades);28;504;Mr. Cheney
2026 / abr.;cheesecake;18;504;Mr. Cheney
2026 / abr.;cookie avelã crunchy;18;501;Mr. Cheney
2026 / abr.;chá twinnigs;49;490;Bebidas
2026 / abr.;croissant tradicional;22;462;Origens
2026 / abr.;clássico;33;462;Bebidas
2026 / abr.;1 cookie + cafe ou chocolate;21;459,9;Mr. Cheney
2026 / abr.;pão com ovo;16;448;Origens
2026 / abr.;loj1 - café + 3 pães de queijo;27;432;Mr. Cheney
2026 / abr.;caixa 4 cookies;5;425;Mr. Cheney
2026 / abr.;descafeinado;26;416;Bebidas
2026 / abr.;suco natural;28;392;Bebidas
2026 / abr.;2 estrelas - cookie + 1 expresso origens;20;387;Mr. Cheney
2026 / abr.;esfiha de queijo;32;384;Origens
2026 / abr.;espresso macchiato pequeno;34;374;Bebidas
2026 / abr.;loj4 - suco + croissant de presunto e queijo;11;363;Origens
2026 / abr.;loj2 - café + cookie clássico;19;359,1;Mr. Cheney
2026 / abr.;refrigerante 220ml;41;328;Bebidas
2026 / abr.;cookie sandwich g;8;324,7;Mr. Cheney
2026 / abr.;cappuccino dos chocólatras;18;324;Bebidas
2026 / abr.;refrigerante 350ml;32;320;Bebidas
2026 / abr.;brownie chocolate;11;314,9;Mr. Cheney
2026 / abr.;cookie pao de mel;11;297;Mr. Cheney
2026 / abr.;cookie cenoura com chocolate;11;297;Mr. Cheney
2026 / abr.;pão de queijo (3 unid) + café;18;288;Mr. Cheney
2026 / abr.;cookie my way - day after;21;283,5;Mr. Cheney
2026 / abr.;esfiha de carne;23;276;Origens
2026 / abr.;pão na chapa;27;270;Origens
2026 / abr.;cookie day after;27;266,65;Mr. Cheney
2026 / abr.;novo cinnamon roll clássico;8;241,3;Mr. Cheney
2026 / abr.;ovo cookie loja;8;240;Mr. Cheney
2026 / abr.;pancakes 3 unidades;10;240;Mr. Cheney
2026 / abr.;cookie bomb;7;214;Mr. Cheney
2026 / abr.;coxinha de batata doce com frango;13;208;Origens
2026 / abr.;chocolate quente pequeno;17;204;Bebidas
2026 / abr.;cookie ovomaltine;7;199;Mr. Cheney
2026 / abr.;cookie pistache;7;189;Mr. Cheney
2026 / abr.;pão com carne suculenta;5;185;Origens
2026 / abr.;apple cobbler;6;168;Mr. Cheney
2026 / abr.;loj3 - café + croissant tradicional;7;168;Origens
2026 / abr.;brownie chocolate c/ nozes;6;162;Mr. Cheney
2026 / abr.;3 estrelas - croissant recheado + suco natural com água;5;153;Origens
2026 / abr.;loj7 - café + pão com requeijão;7;147;Origens
2026 / abr.;cookie dark;5;140;Mr. Cheney
2026 / abr.;cookie ice mountain;5;140;Mr. Cheney
2026 / abr.;cookie with fruits + nutella;5;135;Mr. Cheney
2026 / abr.;pastel assado;7;133;Origens
2026 / abr.;ice cappuccino;6;129;Bebidas
2026 / abr.;chocolate gelado;11;121;Bebidas
2026 / abr.;soda americana;7;119;Bebidas
2026 / abr.;cookie chocolate chips com macadâmia;6;113,4;Mr. Cheney
2026 / abr.;yuba;6;108;Mr. Cheney
2026 / abr.;delícia detox;6;108;Bebidas
2026 / abr.;novo cinnamon roll especial;3;102,7;Mr. Cheney
2026 / abr.;loj6 - café + pão na chapa;6;95,4;Origens
2026 / abr.;pão na chapa com requeijão;5;85;Origens
2026 / abr.;mud frappe;3;84;Bebidas
2026 / abr.;delícia de abacaxi;5;80;Bebidas
2026 / abr.;espresso macchiato grande;5;75;Bebidas
2026 / abr.;chocolate quente com chantilly pequeno;5;70;Bebidas
2026 / abr.;chocolate quente grande;5;70;Bebidas
2026 / abr.;suco lata (290ml);7;63;Bebidas
2026 / abr.;espresso com panna pequeno;5;60;Bebidas
2026 / abr.;ovo cookie loja;2;60;Mr. Cheney
2026 / abr.;coxinha vegana de batata doce com jaca;3;51;Origens
2026 / abr.;waffle de queijo mr. cheney;4;48;Mr. Cheney
2026 / abr.;loj5 - suco + croissant caprese;1;46;Origens
2026 / abr.;refrigerante 350ml;4;44;Bebidas
2026 / abr.;ovo cookie loja;1;39;Mr. Cheney
2026 / abr.;moccha;2;36;Bebidas
2026 / abr.;pão de queijo com batata doce e grãos;3;36;Origens
2026 / abr.;chocolate cremoso grande;2;36;Bebidas
2026 / abr.;ovos orgânicos cremosos;3;36;Origens
2026 / abr.;cookie shake;1;32;Bebidas
2026 / abr.;frappé de café;1;28;Bebidas
2026 / abr.;leitinho da casa;2;28;Bebidas
2026 / abr.;2 estrelas - croissant recheado + suco natural com água;1;25;Origens
2026 / abr.;espresso origens pequeno;2;20;Bebidas
2026 / abr.;chantilly 15 g;4;20;Porções
2026 / abr.;smoothie de fruta;1;19;Bebidas
2026 / abr.;chocolate quente com chantilly grande;1;17;Bebidas
2026 / abr.;suco natural com leite;1;16;Bebidas
2026 / abr.;suco detox;1;16;Bebidas
2026 / abr.;chocolate cremoso pequeno;1;15;Bebidas
2026 / abr.;pistache;1;11;Porções
2026 / abr.;porção de sorvete 80 g;1;8,5;Porções
2026 / abr.;creme de avela nutella 45 g;1;7,9;Porções
2026 / abr.;leite integral 300ml;1;5,5;Porções
2026 / abr.;leite zero lactose ou leite de aveia;1;4;Porções
2026 / mai.;espresso origens pequeno;659;6590;Bebidas
2026 / mai.;novo cinnamon roll tradicional;118;3297,9;Mr. Cheney
2026 / mai.;cookie chocolate chips;166;3227,4;Mr. Cheney
2026 / mai.;cookie triple chocolate;156;3052,95;Mr. Cheney
2026 / mai.;cookie chocolate chips with m&ms;146;2917,6;Mr. Cheney
2026 / mai.;café latte pequeno;219;2628;Bebidas
2026 / mai.;cookie double chocolate;124;2373,6;Mr. Cheney
2026 / mai.;caixa 4 cookies;34;2210;Mr. Cheney
2026 / mai.;caixa 7 cookies;16;2194,4;Mr. Cheney
2026 / mai.;água sem gás;284;1988;Bebidas
2026 / mai.;cappuccino tradicional;97;1552;Bebidas
2026 / mai.;white chocolate;78;1528,2;Mr. Cheney
2026 / mai.;cookie chocolate chips com macadâmia;76;1472,4;Mr. Cheney
2026 / mai.;croissant caprese;37;1443;Origens
2026 / mai.;cookie my way;51;1437;Mr. Cheney
2026 / mai.;cookie doce de leite;52;1169,4;Mr. Cheney
2026 / mai.;café latte grande;71;1136;Bebidas
2026 / mai.;tortas da bottega;59;1062;Origens
2026 / mai.;caixa 4 cookies;12;1021,2;Mr. Cheney
2026 / mai.;água com gás;123;984;Bebidas
2026 / mai.;espresso origens grande;60;900;Bebidas
2026 / mai.;bolo caseiro;60;900;Origens
2026 / mai.;brownie cookie;43;860,7;Mr. Cheney
2026 / mai.;cookie red velvet;38;857,7;Mr. Cheney
2026 / mai.;pão de queijo (6 unidades);45;810;Mr. Cheney
2026 / mai.;pão de queijo (3 unidades);73;803;Mr. Cheney
2026 / mai.;croissant tradicional;38;798;Origens
2026 / mai.;novo cinnamon roll especial;23;781,7;Mr. Cheney
2026 / mai.;brownie chocolate;26;734,9;Mr. Cheney
2026 / mai.;cheesecake;26;728;Mr. Cheney
2026 / mai.;suco natural;52;728;Bebidas
2026 / mai.;1 cookie + cafe ou chocolate;31;678,9;Mr. Cheney
2026 / mai.;croissant presunto e queijo;27;675;Origens
2026 / mai.;pão com carne suculenta;18;666;Origens
2026 / mai.;refrigerante 350ml;62;620;Bebidas
2026 / mai.;pancakes 2 unidades;28;585,2;Mr. Cheney
2026 / mai.;coxinha de batata doce com frango;36;576;Origens
2026 / mai.;cookie avelã crunchy;20;550;Mr. Cheney
2026 / mai.;cappuccino dos chocólatras;29;522;Bebidas
2026 / mai.;cookie sandwich g;12;504,3;Mr. Cheney
2026 / mai.;chá twinnigs;49;490;Bebidas
2026 / mai.;pão com ovo;17;476;Origens
2026 / mai.;clássico;34;476;Bebidas
2026 / mai.;loj1 - café + 3 pães de queijo;29;464;Mr. Cheney
2026 / mai.;2 estrelas - cookie + 1 expresso origens;24;462,6;Mr. Cheney
2026 / mai.;pão de queijo (3 unid) + café;28;448;Mr. Cheney
2026 / mai.;refrigerante 220ml;55;440;Bebidas
2026 / mai.;loj4 - suco + croissant de presunto e queijo;12;396;Origens
2026 / mai.;espresso macchiato pequeno;34;374;Bebidas
2026 / mai.;esfiha de queijo;29;354,5;Origens
2026 / mai.;cookie ovomaltine;12;344;Mr. Cheney
2026 / mai.;esfiha de carne;27;324;Origens
2026 / mai.;cookie pistache;11;312;Mr. Cheney
2026 / mai.;cookie dark;11;302;Mr. Cheney
2026 / mai.;cookie day after;30;301,5;Mr. Cheney
2026 / mai.;cookie bomb;10;295;Mr. Cheney
2026 / mai.;apple cobbler;10;293,8;Mr. Cheney
2026 / mai.;loj2 - café + cookie clássico;15;283,5;Mr. Cheney
2026 / mai.;pão na chapa;28;280;Origens
2026 / mai.;chocolate quente pequeno;22;264;Bebidas
2026 / mai.;descafeinado;15;240;Bebidas
2026 / mai.;pancakes 3 unidades;10;240;Mr. Cheney
2026 / mai.;chocolate quente grande;16;224;Bebidas
2026 / mai.;milk shake;7;217;Bebidas
2026 / mai.;loj6 - café + pão na chapa;13;206,7;Origens
2026 / mai.;cookie ice mountain;7;196;Mr. Cheney
2026 / mai.;cookie my way - day after;13;175,5;Mr. Cheney
2026 / mai.;chocolate cremoso grande;9;162;Bebidas
2026 / mai.;cookie with fruits + nutella;6;162;Mr. Cheney
2026 / mai.;pão na chapa com requeijão;9;153;Origens
2026 / mai.;novo cinnamon roll clássico;5;146;Mr. Cheney
2026 / mai.;cookie pao de mel;5;135;Mr. Cheney
2026 / mai.;ice cappuccino;6;129;Bebidas
2026 / mai.;yuba;7;126;Mr. Cheney
2026 / mai.;chocolate cremoso pequeno;8;120;Bebidas
2026 / mai.;café mr cheney moído- 250 g;2;116,2;Origens
2026 / mai.;coxinha vegana de batata doce com jaca;6;102;Origens
2026 / mai.;leitinho da casa;7;98;Bebidas
2026 / mai.;espresso macchiato grande;6;90;Bebidas
2026 / mai.;pão de queijo com batata doce e grãos;6;88;Origens
2026 / mai.;soda americana;5;85;Bebidas
2026 / mai.;chocolate quente com chantilly grande;5;85;Bebidas
2026 / mai.;mud frappe;3;84;Bebidas
2026 / mai.;cookie brigadeirão;3;81;Mr. Cheney
2026 / mai.;pastel assado;4;76;Origens
2026 / mai.;espresso com panna pequeno;6;72;Bebidas
2026 / mai.;moccha;4;72;Bebidas
2026 / mai.;quichê de alho poró;4;72;Origens
2026 / mai.;chocolate quente com chantilly pequeno;5;70;Bebidas
2026 / mai.;chocolate gelado;6;66;Bebidas
2026 / mai.;espresso com panna grande;4;64;Bebidas
2026 / mai.;suco lata (290ml);7;63;Bebidas
2026 / mai.;cookie cenoura com chocolate;2;54;Mr. Cheney
2026 / mai.;waffle de queijo mr. cheney;4;48;Mr. Cheney
2026 / mai.;loj3 - café + croissant tradicional;2;48;Origens
2026 / mai.;delícia detox;2;36;Bebidas
2026 / mai.;cookie shake;1;32;Bebidas
2026 / mai.;suco natural com leite;2;32;Bebidas
2026 / mai.;croissant presunto e queijo;1;24;Origens
2026 / mai.;pão de queijo (6 unidades);1;23;Mr. Cheney
2026 / mai.;refrigerante 350ml;2;22;Bebidas
2026 / mai.;loj7 - café + pão com requeijão;1;21;Origens
2026 / mai.;suco detox;1;16;Bebidas
2026 / mai.;delícia de abacaxi;1;16;Bebidas
2026 / mai.;chantilly 15 g;2;10;Porções
2026 / mai.;refrigerante 220ml;1;9,5;Bebidas
2026 / mai.;geleia (amora e morango) 30 g;2;9;Porções
2026 / mai.;nutella;1;9;Porções
2026 / mai.;creme de avela nutella 45 g;1;7,9;Porções
2026 / jun.;espresso origens pequeno;557;5570;Bebidas
2026 / jun.;cookie triple chocolate;148;2845,2;Mr. Cheney
2026 / jun.;novo cinnamon roll tradicional;97;2682,2;Mr. Cheney
2026 / jun.;cookie chocolate chips;126;2447,4;Mr. Cheney
2026 / jun.;café latte pequeno;189;2268;Bebidas
2026 / jun.;cookie chocolate chips with m&ms;112;2253,2;Mr. Cheney
2026 / jun.;caixa 7 cookies;16;2110,4;Mr. Cheney
2026 / jun.;cookie double chocolate;104;1983,6;Mr. Cheney
2026 / jun.;caixa 4 cookies;28;1820;Mr. Cheney
2026 / jun.;white chocolate;83;1616,7;Mr. Cheney
2026 / jun.;cookie my way;51;1414;Mr. Cheney
2026 / jun.;cappuccino tradicional;88;1408;Bebidas
2026 / jun.;cookie chocolate chips com macadâmia;69;1328,1;Mr. Cheney
2026 / jun.;água sem gás;185;1295;Bebidas
2026 / jun.;cookie red velvet;55;1209,6;Mr. Cheney
2026 / jun.;cookie doce de leite;50;1115,4;Mr. Cheney
2026 / jun.;pão de queijo (6 unidades);54;977;Mr. Cheney
2026 / jun.;café latte grande;61;976;Bebidas
2026 / jun.;espresso origens grande;59;885;Bebidas
2026 / jun.;caixa 4 cookies;10;848;Mr. Cheney
2026 / jun.;pão de queijo (3 unidades);73;803;Mr. Cheney
2026 / jun.;cookie sandwich g;18;768,8;Mr. Cheney
2026 / jun.;brownie cookie;39;761,1;Mr. Cheney
2026 / jun.;bolo caseiro;50;757;Origens
2026 / jun.;caixa 18 cookies;2;751;Mr. Cheney
2026 / jun.;croissant presunto e queijo;27;675;Origens
2026 / jun.;croissant caprese;17;663;Origens
2026 / jun.;cheesecake;22;616;Mr. Cheney
2026 / jun.;brownie chocolate;21;601,8;Mr. Cheney
2026 / jun.;cookie avelã crunchy;21;597;Mr. Cheney
2026 / jun.;tortas da bottega;32;596,7;Origens
2026 / jun.;água com gás;73;584;Bebidas
2026 / jun.;croissant tradicional;27;567;Origens
2026 / jun.;cappuccino dos chocólatras;28;504;Bebidas
2026 / jun.;loj2 - café + cookie clássico;25;472,5;Mr. Cheney
2026 / jun.;suco natural;33;462;Bebidas
2026 / jun.;refrigerante 350ml;46;460;Bebidas
2026 / jun.;novo cinnamon roll especial;13;433,7;Mr. Cheney
2026 / jun.;pancakes 2 unidades;19;397,1;Mr. Cheney
2026 / jun.;chocolate quente pequeno;33;396;Bebidas
2026 / jun.;2 estrelas - cookie + 1 expresso origens;20;381;Mr. Cheney
2026 / jun.;espresso macchiato pequeno;33;363;Bebidas
2026 / jun.;coxinha de batata doce com frango;22;352;Origens
2026 / jun.;1 cookie + cafe ou chocolate;16;350,4;Mr. Cheney
2026 / jun.;chá twinnigs;34;340;Bebidas
2026 / jun.;clássico;24;336;Bebidas
2026 / jun.;pão com ovo;12;336;Origens
2026 / jun.;refrigerante 220ml;41;328;Bebidas
2026 / jun.;cookie pistache;11;312;Mr. Cheney
2026 / jun.;pancakes 3 unidades;13;312;Mr. Cheney
2026 / jun.;cookie bomb;11;307;Mr. Cheney
2026 / jun.;pão com carne suculenta;8;296;Origens
2026 / jun.;cookie ovomaltine;10;275;Mr. Cheney
2026 / jun.;pão de queijo (3 unid) + café;16;256;Mr. Cheney
2026 / jun.;loj1 - café + 3 pães de queijo;14;224;Mr. Cheney
2026 / jun.;cookie ice mountain;8;224;Mr. Cheney
2026 / jun.;cookie day after;22;221,4;Mr. Cheney
2026 / jun.;esfiha de carne;18;216;Origens
2026 / jun.;novo cinnamon roll clássico;7;212,1;Mr. Cheney
2026 / jun.;esfiha de queijo;16;192;Origens
2026 / jun.;pão na chapa;18;180;Origens
2026 / jun.;chocolate cremoso grande;10;180;Bebidas
2026 / jun.;cookie dark;6;177;Mr. Cheney
2026 / jun.;café mr cheney moído- 250 g;3;174,3;Origens
2026 / jun.;loj4 - suco + croissant de presunto e queijo;5;165;Origens
2026 / jun.;chocolate cremoso pequeno;9;135;Bebidas
2026 / jun.;pão de queijo com batata doce e grãos;9;132;Origens
2026 / jun.;descafeinado;8;128;Bebidas
2026 / jun.;chocolate quente grande;9;126;Bebidas
2026 / jun.;cookie with fruits + nutella;4;108;Mr. Cheney
2026 / jun.;3 estrelas - croissant recheado + suco natural com água;3;103;Origens
2026 / jun.;pão na chapa com requeijão;6;102;Origens
2026 / jun.;waffle de queijo mr. cheney;8;96;Mr. Cheney
2026 / jun.;cookie shake;3;96;Bebidas
2026 / jun.;loj6 - café + pão na chapa;6;95,4;Origens
2026 / jun.;coxinha vegana de batata doce com jaca;5;85;Origens
2026 / jun.;soda americana;5;85;Bebidas
2026 / jun.;suco lata (290ml);9;81;Bebidas
2026 / jun.;cookie brigadeirão;3;81;Mr. Cheney
2026 / jun.;cookie my way - day after;6;81;Mr. Cheney
2026 / jun.;espresso com panna pequeno;6;72;Bebidas
2026 / jun.;apple cobbler;2;62,9;Mr. Cheney
2026 / jun.;pancakes 2 unidades;2;62;Mr. Cheney
2026 / jun.;espresso macchiato grande;4;60;Bebidas
2026 / jun.;yuba;3;54;Mr. Cheney
2026 / jun.;moccha;3;54;Bebidas
2026 / jun.;croissant bomb;2;50;Origens
2026 / jun.;suco detox;3;48;Bebidas
2026 / jun.;loj3 - café + croissant tradicional;2;48;Origens
2026 / jun.;espresso com panna grande;3;48;Bebidas
2026 / jun.;2 estrelas - croissant recheado + suco natural com água;1;39;Origens
2026 / jun.;pastel assado;2;38;Origens
2026 / jun.;quichê de alho poró;2;36;Origens
2026 / jun.;chocolate quente com chantilly grande;2;34;Bebidas
2026 / jun.;chocolate gelado;3;33;Bebidas
2026 / jun.;delícia de abacaxi;2;32;Bebidas
2026 / jun.;suco natural com leite;2;32;Bebidas
2026 / jun.;frappé de café;1;28;Bebidas
2026 / jun.;chocolate quente com chantilly pequeno;2;28;Bebidas
2026 / jun.;ice cappuccino;1;21,5;Bebidas
2026 / jun.;smoothie de fruta;1;19;Bebidas
2026 / jun.;leitinho da casa;1;14;Bebidas
2026 / jun.;leite integral 300ml;2;11;Porções
2026 / jun.;chantilly 15 g;2;10;Porções
2026 / jun.;refrigerante 350ml;1;9,9;Bebidas
2026 / jun.;geleia (amora e morango) 30 g;2;9;Porções
2026 / jun.;doce de leite 40 g;1;5,1;Porções
2026 / jul.;espresso origens pequeno;543;5430;Bebidas
2026 / jul.;cookie chocolate chips;151;2931,9;Mr. Cheney
2026 / jul.;cookie triple chocolate;151;2877,9;Mr. Cheney
2026 / jul.;cookie chocolate chips with m&ms;132;2626,8;Mr. Cheney
2026 / jul.;café latte pequeno;203;2436;Bebidas
2026 / jul.;novo cinnamon roll tradicional;86;2361,5;Mr. Cheney
2026 / jul.;cookie double chocolate;105;1996,5;Mr. Cheney
2026 / jul.;caixa 4 cookies;29;1924,2;Mr. Cheney
2026 / jul.;white chocolate;91;1755,9;Mr. Cheney
2026 / jul.;caixa 7 cookies;12;1684,8;Mr. Cheney
2026 / jul.;água sem gás;231;1673;Bebidas
2026 / jul.;cookie my way;57;1554;Mr. Cheney
2026 / jul.;cookie chocolate chips com macadâmia;80;1518;Mr. Cheney
2026 / jul.;cookie red velvet;68;1514,7;Mr. Cheney
2026 / jul.;croissant caprese;28;1092;Origens
2026 / jul.;cookie doce de leite;45;1031,4;Mr. Cheney
2026 / jul.;cappuccino tradicional;63;1008;Bebidas
2026 / jul.;café latte grande;63;1008;Bebidas
2026 / jul.;pão de queijo (6 unidades);53;984;Mr. Cheney
2026 / jul.;pão de queijo (3 unidades);82;924;Mr. Cheney
2026 / jul.;brownie cookie;46;887,4;Mr. Cheney
2026 / jul.;cheesecake;30;840;Mr. Cheney
2026 / jul.;espresso origens grande;54;810;Bebidas
2026 / jul.;suco natural;52;728;Bebidas
2026 / jul.;bolo caseiro;40;632;Origens
2026 / jul.;croissant presunto e queijo;25;629,9;Origens
2026 / jul.;água com gás;73;600;Bebidas
2026 / jul.;cookie avelã crunchy;21;597;Mr. Cheney
2026 / jul.;croissant tradicional;27;567;Origens
2026 / jul.;tortas da bottega;29;522;Origens
2026 / jul.;cookie sandwich g;12;518,1;Mr. Cheney
2026 / jul.;refrigerante 350ml;51;510;Bebidas
2026 / jul.;caixa 4 cookies;6;507,6;Mr. Cheney
2026 / jul.;caixa 4 cookies;6;507,6;Mr. Cheney
2026 / jul.;chá twinnigs;49;490;Bebidas
2026 / jul.;brownie chocolate;17;489,8;Mr. Cheney
2026 / jul.;clássico;32;448;Bebidas
2026 / jul.;espresso macchiato pequeno;40;440;Bebidas
2026 / jul.;pancakes 2 unidades;21;438,9;Mr. Cheney
2026 / jul.;1 cookie + cafe ou chocolate;19;416,1;Mr. Cheney
2026 / jul.;coxinha de batata doce com frango;24;397;Origens
2026 / jul.;pão com carne suculenta;9;333;Origens
2026 / jul.;2 estrelas - cookie + 1 expresso origens;16;308,4;Mr. Cheney
2026 / jul.;pão com ovo;11;308;Origens
2026 / jul.;cookie bomb;11;307;Mr. Cheney
2026 / jul.;loj1 - café + 3 pães de queijo;19;304;Mr. Cheney
2026 / jul.;novo cinnamon roll especial;9;297,1;Mr. Cheney
2026 / jul.;cappuccino dos chocólatras;16;291;Bebidas
2026 / jul.;esfiha de queijo;22;270,5;Origens
2026 / jul.;cookie ice mountain;9;252;Mr. Cheney
2026 / jul.;pão na chapa;25;250;Origens
2026 / jul.;caixa 12 cookies;1;249;Mr. Cheney
2026 / jul.;chocolate quente pequeno;19;228;Bebidas
2026 / jul.;cookie pistache;8;221;Mr. Cheney
2026 / jul.;cookie dark;8;221;Mr. Cheney
2026 / jul.;esfiha de carne;18;216;Origens
2026 / jul.;refrigerante 220ml;26;208;Bebidas
2026 / jul.;coxinha vegana de batata doce com jaca;11;192,5;Origens
2026 / jul.;descafeinado;12;192;Bebidas
2026 / jul.;loj2 - café + cookie clássico;8;151,2;Mr. Cheney
2026 / jul.;moccha;8;144;Bebidas
2026 / jul.;chocolate cremoso pequeno;9;135;Bebidas
2026 / jul.;espresso macchiato grande;9;135;Bebidas
2026 / jul.;pão de queijo (3 unid) + café;8;128;Mr. Cheney
2026 / jul.;3 estrelas - croissant recheado + suco natural com água;4;128;Origens
2026 / jul.;chocolate cremoso grande;7;126;Bebidas
2026 / jul.;cookie ovomaltine;4;123;Mr. Cheney
2026 / jul.;café mr cheney moído- 250 g;2;116,2;Origens
2026 / jul.;cookie day after;12;113,4;Mr. Cheney
2026 / jul.;cookie with fruits + nutella;4;108;Mr. Cheney
2026 / jul.;suco lata (290ml);12;108;Bebidas
2026 / jul.;chocolate quente grande;7;98;Bebidas
2026 / jul.;loj6 - café + pão na chapa;6;95,4;Origens
2026 / jul.;cookie my way - day after;7;94,5;Mr. Cheney
2026 / jul.;apple cobbler;3;90,9;Mr. Cheney
2026 / jul.;novo cinnamon roll clássico;3;87,6;Mr. Cheney
2026 / jul.;loj8 - suco + yuba;3;81;Mr. Cheney
2026 / jul.;creme de mandioquinha;2;79,8;Origens
2026 / jul.;loj3 - café + croissant tradicional;3;72;Origens
2026 / jul.;espresso com panna pequeno;6;72;Bebidas
2026 / jul.;chocolate quente com chantilly grande;4;68;Bebidas
2026 / jul.;loj4 - suco + croissant de presunto e queijo;2;66;Origens
2026 / jul.;crie seu milk shake;2;66;Bebidas
2026 / jul.;suco detox;4;64;Bebidas
2026 / jul.;pão de queijo com batata doce e grãos;4;64;Origens
2026 / jul.;cookie shake;2;64;Bebidas
2026 / jul.;espresso com panna grande;4;64;Bebidas
2026 / jul.;pastel assado;3;57;Origens
2026 / jul.;cookie brigadeirão;2;54;Mr. Cheney
2026 / jul.;delícia detox;3;54;Bebidas
2026 / jul.;cappucheney;3;54;Mr. Cheney
2026 / jul.;soda americana;3;51;Bebidas
2026 / jul.;pão na chapa com requeijão;3;51;Origens
2026 / jul.;croissant bomb;2;50;Origens
2026 / jul.;delícia de abacaxi;3;48;Bebidas
2026 / jul.;pancakes 3 unidades;2;48;Mr. Cheney
2026 / jul.;leitinho da casa;3;42;Bebidas
2026 / jul.;yuba;2;36;Mr. Cheney
2026 / jul.;quichê de alho poró;2;36;Origens
2026 / jul.;waffle de queijo mr. cheney;3;36;Mr. Cheney
2026 / jul.;suco natural com leite;2;32;Bebidas
2026 / jul.;ovos orgânicos cremosos;2;24;Origens
2026 / jul.;ice cappuccino;1;21,5;Bebidas
2026 / jul.;chantilly 15 g;4;20;Porções
2026 / jul.;smoothie de fruta;1;19;Bebidas
2026 / jul.;chocolate gelado;1;11;Bebidas
2026 / jul.;porção de sorvete 80 g;1;8,5;Porções
2026 / jul.;leite integral 300ml;1;5,5;Porções
2026 / jul.;geleia (amora e morango) 30 g;1;4,5;Porções
2026 / ago.;espresso origens pequeno;617;6170;Bebidas
2027 / ago.;cookie chocolate chips;134;2544,6;Mr. Cheney
2028 / ago.;cookie triple chocolate;132;2524,8;Mr. Cheney
2029 / ago.;caixa 4 cookies;38;2470;Mr. Cheney
2030 / ago.;café latte pequeno;194;2328;Bebidas
2031 / ago.;novo cinnamon roll tradicional;77;2079;Mr. Cheney
2032 / ago.;cookie chocolate chips with m&ms;101;2022,1;Mr. Cheney
2033 / ago.;cookie chocolate chips com macadâmia;97;1881,3;Mr. Cheney
2034 / ago.;água sem gás;219;1752;Bebidas
2035 / ago.;cookie double chocolate;81;1542,9;Mr. Cheney
2036 / ago.;white chocolate;71;1419,9;Mr. Cheney
2037 / ago.;caixa 7 cookies;11;1391,4;Mr. Cheney
2038 / ago.;cappuccino tradicional;75;1200;Bebidas
2039 / ago.;cookie sandwich g;25;1096;Mr. Cheney
2040 / ago.;cookie my way;40;1080;Mr. Cheney
2041 / ago.;café latte grande;64;1024;Bebidas
2042 / ago.;cookie red velvet;41;913,2;Mr. Cheney
2043 / ago.;água com gás;89;801;Bebidas
2044 / ago.;cheesecake;27;776,7;Mr. Cheney
2045 / ago.;suco natural;55;770;Bebidas
2046 / ago.;pão de queijo (3 unidades);63;756;Mr. Cheney
2047 / ago.;brownie cookie;38;742,2;Mr. Cheney
2048 / ago.;bolo caseiro;43;736;Origens
2049 / ago.;tortas da bottega;40;720;Origens
2050 / ago.;caixa 4 cookies;8;676,8;Mr. Cheney
2051 / ago.;clássico;48;672;Bebidas
2052 / ago.;croissant tradicional;32;672;Origens
2053 / ago.;espresso origens grande;43;645;Bebidas
2054 / ago.;pão de queijo (6 unidades);31;615;Mr. Cheney
2055 / ago.;brownie chocolate;18;524,7;Mr. Cheney
2056 / ago.;espresso macchiato pequeno;47;517;Bebidas
2057 / ago.;chá twinnigs;50;500;Bebidas
2058 / ago.;cookie avelã crunchy;17;474;Mr. Cheney
2059 / ago.;pancakes 2 unidades;21;438,9;Mr. Cheney
2060 / ago.;croissant presunto e queijo;16;400;Origens
2061 / ago.;loj2 - café + cookie clássico;21;396,9;Mr. Cheney
2062 / ago.;refrigerante 350ml;38;380;Bebidas
2063 / ago.;1 cookie + cafe ou chocolate;17;372,3;Mr. Cheney
2064 / ago.;pão com ovo;13;364;Origens
2065 / ago.;croissant caprese;9;351;Origens
2066 / ago.;cookie turma da mônica - mônica;12;342;Mr. Cheney
2067 / ago.;apple cobbler;10;328,3;Mr. Cheney
2068 / ago.;pão de queijo (3 unid) + café;20;320;Mr. Cheney
2069 / ago.;coxinha de batata doce com frango;19;317;Origens
2070 / ago.;cookie turma da mônica - magali;10;285;Mr. Cheney
2071 / ago.;cookie turma da mônica - cebolinha;10;285;Mr. Cheney
2072 / ago.;cappuccino dos chocólatras;14;266;Bebidas
2073 / ago.;loj1 - café + 3 pães de queijo;16;261;Mr. Cheney
2074 / ago.;esfiha de carne;21;252;Origens
2075 / ago.;pancakes 3 unidades;10;240;Mr. Cheney
2076 / ago.;esfiha de queijo;16;218;Origens
2077 / ago.;loj7 - café + pão com requeijão;10;210;Origens
2078 / ago.;pão na chapa;21;210;Origens
2079 / ago.;novo cinnamon roll clássico;7;204,4;Mr. Cheney
2080 / ago.;cookie ice mountain;7;196;Mr. Cheney
2081 / ago.;chocolate quente pequeno;16;192;Bebidas
2082 / ago.;2 estrelas - cookie + 1 expresso origens;10;189;Mr. Cheney
2083 / ago.;espresso macchiato grande;12;180;Bebidas
2084 / ago.;chocolate gelado;13;143;Bebidas
2085 / ago.;cookie pistache;5;140;Mr. Cheney
2086 / ago.;refrigerante 220ml;17;136;Bebidas
2087 / ago.;loj4 - suco + croissant de presunto e queijo;4;132;Origens
2088 / ago.;loj6 - café + pão na chapa;8;127,2;Origens
2089 / ago.;cookie day after;13;124,35;Mr. Cheney
2090 / ago.;cookie my way - day after;9;121,5;Mr. Cheney
2091 / ago.;waffle de queijo mr. cheney;10;120;Mr. Cheney
2092 / ago.;espresso com panna pequeno;10;120;Bebidas
2093 / ago.;café mr cheney moído- 250 g;2;116,2;Origens
2094 / ago.;cookie turma da mônica - cascão;4;114;Mr. Cheney
2095 / ago.;chocolate quente grande;8;112;Bebidas
2096 / ago.;pão com carne suculenta;3;111;Origens
2097 / ago.;ice cappuccino;5;110;Bebidas
2098 / ago.;novo cinnamon roll especial;3;102,7;Mr. Cheney
2099 / ago.;caixa 4 cinnamon rolls tradicionais;1;99;Mr. Cheney
2100 / ago.;cookie shake;3;96;Bebidas
2101 / ago.;cappucheney;5;90;Mr. Cheney
2102 / ago.;suco lata (290ml);10;90;Bebidas
2103 / ago.;pão na chapa com requeijão;5;85;Origens
2104 / ago.;coxinha vegana de batata doce com jaca;5;85;Origens
2105 / ago.;cookie ovomaltine;3;81;Mr. Cheney
2106 / ago.;cookie with fruits + nutella;3;81;Mr. Cheney
2107 / ago.;cookie brigadeirão;3;81;Mr. Cheney
2108 / ago.;cookie bomb;3;81;Mr. Cheney
2109 / ago.;descafeinado;5;80;Bebidas
2110 / ago.;soda americana;4;68;Bebidas
2111 / ago.;delícia de abacaxi;4;64;Bebidas
2112 / ago.;chocolate cremoso pequeno;4;60;Bebidas
2113 / ago.;pastel assado;3;57;Origens
2114 / ago.;mud frappe;2;56;Bebidas
2115 / ago.;quichê de alho poró;3;54;Origens
2116 / ago.;croissant bomb;2;50;Origens
2117 / ago.;loj3 - café + croissant tradicional;2;48;Origens
2118 / ago.;suco natural com leite;3;48;Bebidas
2119 / ago.;bolo de banana, maçã e canela;2;44;Origens
2120 / ago.;2 estrelas - croissant recheado + suco natural com água;1;39;Origens
2121 / ago.;delícia detox;2;36;Bebidas
2122 / ago.;chocolate cremoso grande;2;36;Bebidas
2123 / ago.;suco detox;2;32;Bebidas
2124 / ago.;espresso com panna grande;2;32;Bebidas
2125 / ago.;seu cookie favorito + coca-cola;1;31,9;Mr. Cheney
2126 / ago.;frappé de café;1;28;Bebidas
2127 / ago.;leitinho da casa;2;28;Bebidas
2128 / ago.;loj8 - suco + yuba;1;27;Mr. Cheney
2129 / ago.;3 estrelas - croissant recheado + suco natural com água;1;25;Origens
2130 / ago.;ovos orgânicos cremosos;2;24;Origens
2131 / ago.;pão de queijo com batata doce e grãos;2;24;Origens
2132 / ago.;croissants;1;24;Origens
2133 / ago.;smoothie de fruta;1;19;Bebidas
2134 / ago.;yuba;1;18;Mr. Cheney
2135 / ago.;creme de leite ninho;2;16;Porções
2136 / ago.;brigadeiro;1;9;Porções
2137 / ago.;porção de sorvete 80 g;1;8,5;Porções
2138 / ago.;doce de leite 40 g;1;5,1;Porções
2139 / ago.;chantilly 15 g;1;5;Porções`;

const MONTH_MAP: Record<string, string> = {
  'jan': '01',
  'fev': '02',
  'mar': '03',
  'abr': '04',
  'mai': '05',
  'jun': '06',
  'jul': '07',
  'ago': '08',
  'set': '09',
  'out': '10',
  'nov': '11',
  'dez': '12'
};

function parseMonth(raw: string): string {
  const str = raw.trim().toLowerCase();
  
  // Notice: August entries had an excel auto-fill drag artifact (2026/ago, 2027/ago, ... 2139/ago)
  if (str.includes('ago')) {
    return '08/2026';
  }

  const parts = str.split('/').map(s => s.trim().replace('.', ''));
  if (parts.length === 2) {
    let year = parts[0];
    let mStr = parts[1].substring(0, 3);
    const mNum = MONTH_MAP[mStr];
    if (mNum) {
      return `${mNum}/${year}`;
    }
  }
  return str;
}

function parseCSVAmount(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  let str = String(val).trim();
  str = str.replace(/[R$\s]/g, '');
  if (str.includes(',') && str.includes('.')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

function generateDeterministicId(item: any, type: string) {
  const sanitize = (val: any) => String(val || '').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_').substring(0, 50);
  const seqStr = item.seq ? `_seq_${item.seq}` : '';
  return `sale_${sanitize(item.mes)}_${sanitize(item.nome)}_${item.quantidade}_${Math.round((item.vendas || 0) * 100)}${seqStr}`;
}

async function run() {
  console.log('Signing in anonymously...');
  await signInAnonymously(auth);
  console.log('Signed in.');

  const lines = rawCSV.split('\n').map(l => l.trim()).filter(Boolean);
  const header = lines[0].split(';');
  console.log('Header:', header);

  const items: any[] = [];
  const monthCounts: Record<string, number> = {};
  const monthTotals: Record<string, number> = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(';');
    if (parts.length < 4) continue;

    const rawMes = parts[0];
    const rawNome = parts[1];
    const rawQty = parts[2];
    const rawVendas = parts[3];
    const rawCat = parts[4] || 'Geral';

    const mes = parseMonth(rawMes);
    const nome = rawNome.trim();
    const quantidade = parseCSVAmount(rawQty);
    const vendas = parseCSVAmount(rawVendas);
    const categoria = rawCat.trim();

    if (!mes || !nome || quantidade <= 0) continue;

    monthCounts[mes] = (monthCounts[mes] || 0) + 1;
    monthTotals[mes] = (monthTotals[mes] || 0) + vendas;

    const [m, y] = mes.split('/');
    const data = `01/${m}/${y}`;

    items.push({
      mes,
      data,
      nome,
      produto: nome,
      quantidade,
      vendas,
      total: vendas,
      precoUnitario: quantidade > 0 ? (vendas / quantidade) : 0,
      categoria,
      origem: 'Balcão',
      tipoEntrega: 'Balcão',
      userId: 'shared_franquia_data',
    });
  }

  console.log(`Total parsed items: ${items.length}`);
  console.log('Breakdown by Month:', monthCounts);
  console.log('Totals by Month (R$):', Object.entries(monthTotals).map(([m, t]) => `${m}: R$ ${t.toFixed(2)}`));

  // Compute sequences for deterministic deduplication
  const occurrences: Record<string, number> = {};
  const processedItems = items.map(item => {
    const key = `${item.mes}_${item.data}_${item.nome}_${item.quantidade}_${item.vendas}`.toLowerCase().trim();
    occurrences[key] = (occurrences[key] || 0) + 1;
    return {
      ...item,
      seq: occurrences[key],
    };
  });

  const pathOfSales = 'users/shared_franquia_data/sales';
  const batchSize = 400;
  console.log(`Uploading ${processedItems.length} items to Firebase collection: ${pathOfSales}...`);

  for (let i = 0; i < processedItems.length; i += batchSize) {
    const chunk = processedItems.slice(i, i + batchSize);
    const batch = writeBatch(db);

    chunk.forEach(item => {
      const id = generateDeterministicId(item, 'sales');
      const docRef = doc(db, pathOfSales, id);
      batch.set(docRef, item);
    });

    if (i === 0) {
      // Log the action inside systemLogs
      const logRef = doc(collection(db, 'users/shared_franquia_data/systemLogs'));
      const logData = {
        data: new Date().toISOString().split('T')[0],
        usuario: 'sistema@franquia.com.br',
        acao: 'Upload CSV',
        tipo: 'Faturamento',
        descricao: `Importação completa de vendas consolidadas de ${Object.keys(monthCounts).join(', ')} (${processedItems.length} produtos).`,
        detalhesRef: { rowCount: processedItems.length },
        userId: 'shared_franquia_data',
        createdAt: new Date().toISOString()
      };
      batch.set(logRef, logData);
    }

    await batch.commit();
    console.log(`Batch ${Math.floor(i / batchSize) + 1} committed (${chunk.length} items).`);
  }

  console.log('✅ ALL SALES IMPORTED SUCCESSFULLY TO FIRESTORE!');
  process.exit(0);
}

run().catch(err => {
  console.error('Error importing sales:', err);
  process.exit(1);
});
