import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Load config
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const csvData = `DATA,FUNCIONÁRIO,ITEM,VALOR,DESCONTO
04/01/2026,Ariane,coca cola 350 ml,"R$ 10,00",50%
06/01/2026,Barbara,Cookie,"R$ 18,90",50%
06/01/2026,Barbara,Pão de queijo,"R$ 11,00",50%
09/01/2026,Ariane,cookie triplo,"R$ 18,90",50%
10/01/2026,Alexandre,Torta Bottega,"R$ 18,00",30%
10/01/2026,Alexandre,Coca 350ml,"R$ 10,00",50%
14/01/2026,Ariane,coca cola 350 ml,"R$ 10,00",50%
14/01/2026,Breno,cookie,"R$ 18,90",50%
15/01/2026,Breno,cookie,"R$ 18,90",50%
15/01/2026,Barbara,Cinnamon,"R$ 31,40",50%
15/01/2026,Barbara,Cookie doce leite,"R$ 21,90",50%
17/01/2026,Arthur,cookie,"R$ 19,90",50%
18/01/2026,Arthur,cookie,"R$ 19,90",50%
18/01/2026,Ariane,latte grande,"R$ 18,00",30%
18/01/2026,Ariane,pao de queijo c/ 6,"R$ 18,00",30%
19/01/2026,Arthur,cookie,"R$ 18,90",50%
19/01/2026,Arthur,Coca 350ml,"R$ 10,00",50%
19/01/2026,Breno,Cookie red velvet,"R$ 21,90",50%
19/01/2026,Breno,cookie,"R$ 18,90",50%
19/01/2026,Breno,cookie,"|19,90",50%
19/10/2026,Breno,Torta Bottega,"R$ 18,00",30%
20/01/2026,Arthur,cookie,"R$ 18,90",50%
20/01/2026,Arthur,cookie,"R$ 18,90",50%
21/01/2026,Cintia,Latte grande,"R$ 16,00",30%
21/01/2026,Cintia,cookie,"R$ 18,90",50%
21/01/2026,Cintia,Oão de queijo 3unid,"R$ 11,00",30%
21/01/2026,Breno,Oão de queijo 3unid,"R$ 11,00",30%
22/01/2026,Breno,cookie,"R$ 18,90",50%
22/01/2026,Arthur,Coca 350ml,"R$ 10,00",50%
23/01/2026,Cintia,Torta Bottega,"R$ 18,00",30%
23/01/2026,Cintia,Coca 350ml,"R$ 10,00",50%
23/01/2026,Arthur,2x macadamia,"R$ 37,80",50%
24/01/2026,Arthur,cookie,"R$ 18,90",50%
24/01/2026,Arthur,suco del vale,"R$ 9,00",50%
25/01/2026,Arthur,suco del vale,"R$ 9,00",50%
25/01/2026,Breno,cookie,"R$ 18,90",50%
26/01/2026,Breno,Oão de queijo 3unid,"R$ 11,00",30%
25/01/2026,Ariane,cookie triplo,"R$ 18,90",50%
25/01/2026,Ariane,cookie triplo,"R$ 18,90",50%
25/01/2026,Ariane,cookie m&ms,"R$ 19,90",50%
25/01/2026,Ariane,cookie m&ms,"R$ 19,90",50%
27/01/2026,Alexandre ,Cookie My Way,"R$ 27,00",50%
27/01/2026,Alexandre,esfiha,"R$ 12,00",30%
27/01/2026,Breno,cookie,"R$ 18,90",50%
27/01/2026,Breno,cookie,"R$ 18,90",50%
27/01/2026,Breno,Apple cobler,"R$ 14,00",30%
27/01/2026,Alexandre,Guaraná 220ml,"R$ 8,00",50%
28/01/2026,Arthur,Cookie red velvet,"R$ 21,90",50%
28/01/2026,Arthur,suco del vale,"R$ 9,00",50%
29/01/2026,Arthur,apple cobler,"R$ 28,00",50%
29/01/2026,Breno,macadamia,"R$ 18,90",50%
29/01/2026,Arthur,my way,"R$ 27,00",50%
31/01/2026,Breno,Cookie red velvet,"R$ 21,90",50%
01/02/2026,Alexandre,my way,"R$ 27,00",50%
02/02/2026,Alexandre,cookie,"R$ 18,90",50%
02/02/2026,Alexandre,cookie,"R$ 18,90",50%
03/02/2026,Arthur,Coca 220ml,"R$ 8,00",50%
01/02/2026,Alexandre,guarana,"R$ 8,00",50%
01/02/2026,Arthur,chips,"R$ 18,90",50%
01/02/2026,Arthur,Coca 350ml,"R$ 10,00",50%
06/02/2026,Alexandre,my way pistache,"R$ 27,00",50%
04/02/2026,Alexandre,guarana 269 ml,"R$ 8,00",50%
04/02/2026,Alexandre,my way pistache,"R$ 27,00",50%
28/01/2026,Barbara,Bolo Canela,"R$ 15,00",30%
05/02/2026,Arthur,coca,"R$ 10,00",50%
05/02/2026,Arthur,Torta Bottega,"R$ 18,00",50%
05/02/2026,Arthur,cookie,"R$ 18,90",50%
05/02/2026,Ernesta,My way,"R$ 27,00",50%
05/02/2026,Ernesta,My way,"R$ 27,00",50%
05/02/2026,Ernesta,My way,"R$ 27,00",50%
05/02/2026,Ernesta,My way,"R$ 27,00",50%
06/02/2026,Alexandre,esfiha,"R$ 12,00",30%
06/02/2026,Alexandre,esfiha,"R$ 12,00",30%
06/02/2026,Alexandre,esfiha,"R$ 8,00",50%
07/02/2026,Ariane,coca cola 350 ml,"R$ 10,00",50%
07/02/2026,Ernesta,MY WAY,"R$ 27,00",50%
07/02/2026,Ernesta,MY WAY,"R$ 27,00",50%
07/02/2026,Ernesta,MY WAY,"R$ 27,00",50%
07/02/2026,Ernesta,MY WAY,"R$ 27,00",50%
07/02/2026,Arthur,cookie,"R$ 18,90",50%
08/02/2026,Alexandre,my way ovomaltine,"R$ 27,00",50%
08/02/2029,Alexandre,guarana zero 350 ml,"R$ 10,00",50%
08/02/2026,Alexandre,my way pistache,"R$ 27,00",50%
09/02/2026,Alexandre,my way pistache,"R$ 27,00",50%
09/02/2026,Alexandre,coca,"R$ 10,00",50%
09/02/2026,Alexandre,my way pistache,"R$ 27,00",50%
09/02/2026,Alexandre,coca,"R$ 10,00",50%
10/02/2026,Alexandre,cinnamon,"R$ 27,00",50%
10/02/2026,Arthur,cookie,"R$ 18,90",50%
10/02/2026,Alexandre,cinnamon,"R$ 12,00",30%
10/02/2026,Arthur,my way,"R$ 27,00",50%
10/02/2026,Arthur,cookie,"R$ 18,90",50%
10/02/2026,Arthur,Coca 220ml,"R$ 8,00",50%
10/02/2026,Arthur,Torta Bottega,"R$ 18,00",50%
10/02/2026,Arthur,Coca 350ml,"R$ 10,00",50%
13/02/2026,Breno,cookie m&ms,"R$ 19,90",50%
13/02/2026,Breno,cookie doce de leite,"R$ 21,90",50%
13/02/2026,Ernesta,torta bottega frango,"R$ 18,00",30%
14/02/2026,Arthur,duplo,"R$ 18,90",50%
14/02/2026,Arthur,pao de queijo 3,"R$ 11,00",30%
14/02/2026,Alexandre,bottega mista,"R$ 18,00",30%
14/02/2026,Alexandre,bottega frango,"R$ 18,00",30%
15/02/2026,Arthur,chips chocolate,"R$ 18,90",50%
15/02/2026,Ernesta,bottega frango,"R$ 18,00",30%
15/02/2026,Ernesta,bottega frango,"R$ 18,00",30%
15/02/2026,Ernesta,coca 0,"R$ 8,00",50%
15/02/2026,Alexandre,guarana,"R$ 8,00",50%
15/02/2026,Alexandre,my way,"R$ 27,00",50%
16/02/2026,Arthur,bottega,"R$ 18,00",30%
16/02/2026,Alexandre,Guaraná 0,"R$ 10,00",50%
16/02/2026,Arthur,coca,"R$ 10,00",50%
16/02/2026,Arthur,suco del vale,"R$ 8,00",60%
16/02/2026,Alexandre,my way,"R$ 27,00",50%
16/02/2026,Ernesta,my way,"R$ 27,00",50%
16/02/2026,Ernesta,my way,"R$ 27,00",50%
16/02/2026,Alexandre,guarana 0,"R$ 8,00",50%
17/02/2026,Ariane,coca,"R$ 10,00",50%
17/02/2026,Arthur,pão ,"R$ 10,00",30%
17/02/2026,Breno,cookie doce de leite,"R$ 21,90",50%
17/02/2026,Ariane,duplo,"R$ 18,90",50%
18/02/2026,Ariane,Pão de queijo 12,"R$ 36,00",50%
18/02/2026,Ariane,Coca cola 350 ML,"R$ 10,00",50%
18/02/2026,Ariane,Latte grande,"R$ 16,00",30%
19/02/2026,Breno,refrigerante ,"R$ 10,00",50%
18/02/2026,Alexandre,my way,"R$ 27,00",50%
20/02/2026,Arthur,metade croissant,"R$ 18,90",50%
20/02/2026,Alexandre,metade croissant,"R$ 18,90",50%
23/02/2026,Alexandre,croissant presunto e queijo,"R$ 25,00",30%
20/02/2026,Alexandre,my way crunchy,"R$ 27,00",50%
21/02/2026,Breno,pao de queijo com 6,"R$ 18,00",50%
21/02/2026,Breno,coca cola 350 ml,"R$ 20,00",50%
23/02/2026,Alexandre,guarana ,"R$ 8,00",50%
24/02/2026,Alexandre,cokiee tradicional,"R$ 18,90",50%
25/02/2026,Alexandre,Cookie doce de leite,"R$ 21,90",50%
26/02/2026,Breno,yuba,"R$ 18,00",50%
26/02/2026,Ariane,2x my way,"R$ 54,00",50%
26/02/2026,Ariane,Cookie duplo,"R$ 18,90",50%
27/02/2026,Barbara,My way,"R$ 27,00",50%
28/02/2026,Alexandre,yuba,"R$ 18,00",50%
28/02/2026,Alexandre,yuba,"R$ 18,00",50%
28/02/2026,Alexandre,yuba,"R$ 18,00",50%
28/02/2026,Alexandre,suco del vale,"R$ 8,00",50%
28/02/2026,Alexandre,suco del vale,"R$ 8,00",50%
01/03/2026,Alexandre,cookie pistache,"R$ 27,00",50%
01/03/2026,Barbara,pastel carne seca,"R$ 19,00",30%
02/03/2026,Alexandre,yuba,"R$ 18,00",50%
02/03/2026,Alexandre,cookie dark,"R$ 27,00",50%
02/03/2026,Alexandre,suco del vale,"R$ 8,00",50%
03/03/2026,Barbara,H2O limoneto,"R$ 10,00",50%
03/03/2026,Alexandre,yuba,"R$ 18,00",50%
03/03/2026,Barbara,yuba,"R$ 18,00",50%
03/03/2026,Alexandre,suco del vale,"R$ 8,00",50%
03/03/2026,Alexandre,my way,"R$ 27,00",50%
03/03/2026,Alexandre,guaraná,"R$ 8,00",50%
04/03/2026,Alexandre,pastel carne seca,"R$ 19,00",30%
05/03/2026,Barbara,Cookie red velvet,"R$ 21,90",50%
05/03/2026,Breno,Cookie macadamia,"R$ 18,90",50%
06/03/2026,Alexandre,Cookie avelã crunchy,"R$ 27,00",50%
06/03/2026,Alexandre,Cookie doce de leite,"R$ 21,90",50%
07/03/2026,Ariane,coca cola 350 ml,"R$ 10,00",50%
07/03/2026,Alexandre,cookie dark,"R$ 27,00",50%
07/03/2026,Barbara,Cookie triple,"R$ 18,90",50%
07/03/2026,Barbara,Cookie tradicional,"R$ 18,90",50%
07/03/2026,Barbara,Torta mista,"R$ 18,00",30%
07/03/2026,Barbara,Cookie triple,"R$ 18,90",50%
08/03/2026,Alexandre,ovocookie,"R$ 30,00",50%
08/03/2026,Ariane,yuba,"R$ 18,00",50%
08/03/2026,Ariane,Latte grande,"R$ 16,00",30%
08/03/2026,Ariane,TORTA FRANGO,"R$ 18,00",30%
09/03/2026,Alexandre,Cinnamon,"R$ 27,00",50%
09/03/2026,Alexandre,Apple cobler,"R$ 14,00",50%
09/03/2026,Barbara,Apple cobler,"R$ 14,00",50%
09/03/2026,Alexandre,H2O limoneto,"R$ 10,00",50%
10/03/2026,Alexandre,H2O limoneto,"R$ 10,00",50%
10/03/2026,Alexandre,Cookie my way,"R$ 27,00",50%
11/03/2026,Breno,croissant presunto e queijo,"R$ 25,00",30%
11/03/2026,Breno,coca cola 350 ml,"R$ 10,00",50%
11/03/2026,Alexandre,my way,"R$ 27,00",50%
12/03/2026,Ariane,coca cola 350 ml,"R$ 10,00",50%
12/03/2026,Breno,coca cola 350 ml,"R$ 10,00",50%
13/03/2026,Alexandre,Cookie day after,"R$ 27,00",50%
13/03/2026,Ariane,suco del vale,"R$ 9,00",50%
14/03/2026,Alexandre,6 pães de queijo,"R$ 18,00",50%
14/03/2026,Alexandre,H2O limoneto,"R$ 10,00",50%
14/03/2026,Ana,croissant presunto e queijo,"R$ 25,00",30%
14/03/2026,Alexandre,H2O limoneto,"R$ 10,00",50%
14/03/2026,Alexandre,Cookie my way,"R$ 27,00",50%
15/03/2026,Alexandre,6 pães de queijo,"R$ 18,00",50%
15/03/2026,Alexandre,H2O limoneto,"R$ 10,00",50%
16/03/2026,Alexandre,6 pães de queijo,"R$ 18,00",50%
16/03/2026,Alexandre,Capuccino tradicional,"R$ 16,00",30%
16/03/2026,Alexandre,H2O limoneto,"R$ 10,00",50%
16/03/2026,Ana,My way,"R$ 27,00",50%
17/03/2026,Alexandre,6 pães de queijo,"R$ 18,00",50%
17/03/2026,Alexandre,H2O limoneto,"R$ 10,00",50%
18/03/2026,Ariane,coca cola 350 ml,"R$ 10,00",50%
18/03/2026,Breno,H2O limoneto,"R$ 10,00",50%
18/03/2026,Ana,pao de queijo com 6,"R$ 18,00",50%
18/03/2026,Ana,OVocookie,"R$ 30,00",50%
18/03/2026,Ana,Agua sem gas,"R$ 7,00",50%
18/03/2026,Alexandre,my way,"R$ 27,00",50%
19/03/2026,Ana,Cinnamon,"R$ 27,00",50%
20/03/2026,Breno,2x macadamia,"R$ 37,80",50%
20/03/2026,Alexandre,6 pães de queijo,"R$ 18,00",50%
20/03/2026,Alexandre,Cookie triple,"R$ 18,90",50%
20/03/2026,Alexandre,Cookie tradicional,"R$ 18,90",50%
21/03/2026,Alexandre,Cookie triple,"R$ 18,90",50%
22/03/2026,Ariane,YUBA,"R$ 18,00",50%
22/03/2026,Ariane,pastel carne seca,"R$ 19,00",30%
22/03/2026,Ariane,coca cola 350 ml,"R$ 10,00",50%
22/03/2026,Ana,croissant presunto e queijo,"R$ 25,00",30%
23/03/2026,Barbara,6 pães de queijo,"R$ 18,00",50%
23/03/2026,Barbara,cookie duplo,"R$ 18,90",50%
23/03/2026,Ana,Cookie my way,"R$ 27,00",50%
23/03/2026,Ana,esfiha de queijo,"R$ 12,00",30%
23/03/2026,Ana,esfiha de queijo,"R$ 12,00",30%
23/03/2026,Ana,cookie branco,"R$ 18,90",50%
23/03/2026,Ana,cookie duplo,"R$ 18,90",50%
23/03/2026,Ana,cookie triple,"R$ 18,90",50%
23/03/2026,Ana,Cookie doce de leite,"R$ 21,90",50%
24/03/2026,Breno,Coca cola 350 ml,"R$ 10,00",50%
24/03/2026,Alexandre,cookie triple,"R$ 18,90",50%
24/03/2026,Barbara,Cookie tradicional,"R$ 18,90",50%
25/03/2026,Breno,Coca cola 350 ml,"R$ 10,00",50%
25/03/2026,Ana,Cookie red velvet,"R$ 21,90",50%
25/03/2026,Ana,cookie triple,"R$ 18,90",50%
27/03/2026,Alexandre,Cookie cenoura ,"R$ 27,00",50%
28/03/2026,Alexandre,Cookie tradicional,"R$ 18,90",50%
28/03/2026,Ariane,6 paes de queijo,"R$ 18,00",50%
28/03/2026,Ariane,torta de frango,"R$ 18,00",50%
28/03/2026,Ariane,torta de frango,"R$ 18,00",50%
28/03/2026,Ariane,YUBA,"R$ 18,00",50%
28/03/2026,Ariane,YUBA,"R$ 18,00",50%
28/03/2026,Alexandre,6 paes de queijo,"R$ 18,00",50%
28/03/2026,Alexandre,H2O limoneto,"R$ 10,00",50%
28/03/2026,Alexandre,6 paes de queijo,"R$ 18,00",50%
28/03/2026,Barbara,cookie triple,"R$ 18,90",50%
28/03/2026,Barbara,6 paes de queijo,"R$ 18,00",50%
30/03/2026,Ana,6 paes de queijo,"R$ 18,00",50%
30/03/2026,Ana,Cookie de cenoura,"R$ 27,00",50%
30/03/2026,Ana,Cookie de pão de mel,"R$ 27,00",50%
30/03/2026,Alexandre,Latte pequeno,"R$ 12,00",30%
30/03/2026,Alexandre,6 paes de queijo,"R$ 18,00",50%
30/03/2026,Alexandre,Coca zero 220ml,"R$ 8,00",50%
31/03/2026,Alexandre,6 paes de queijo,"R$ 18,00",50%
31/03/2026,Alexandre,H2O limoneto,"R$ 10,00",50%
31/03/2026,Alexandre,Cookie triple,"R$ 18,90",50%
31/03/2026,Breno,Cookie M&ms,"R$ 19,90",50%
31/03/2026,Alexandre,Cookie de cenoura,"R$ 27,00",50%
31/03/2026,Barbara,Cookie de cenoura,"R$ 27,00",50%
01/04/2026,Alexandre,Cookie triple,"R$ 18,90",50%
01/04/2026,Ana,Ovocookie,"R$ 30,00",50%
01/04/2026,Ana,croissant presunto e queijo,"R$ 25,00",30%
01/04/2026,Breno,Coca cola 350 ml,"R$ 10,00",50%
02/04/2026,Ana,água com gás,"R$ 8,00",50%
03/04/2026,Alexandre,Cookie triple,"R$ 18,90",50%
03/04/2026,Alexandre,6 paes de queijo,"R$ 18,00",50%
03/04/2026,Alexandre,H2O limoneto,"R$ 10,00",50%
04/04/2026,Alexandre,pankecas com 2 ,"R$ 20,90",50%
04/04/2026,Barbara,Ovocookie,"R$ 30,00",50%
04/04/2026,Alexandre,Capuccino tradicional,"R$ 16,00",30%
04/04/2026,Ana,Agua sem gas,"R$ 7,00",50%
04/04/2026,Breno,Coca cola 350 ml,"R$ 10,00",50%
05/04/2026,Ana,big cookie recheado,"R$ 159,00",50%
05/04/2026,Ariane,suco del vale,"R$ 9,00",50%
06/04/2026,Alexandre,Limoneto,"R$ 10,00",50%
06/04/2026,Alexandre,esfiha de queijo,"R$ 12,00",30%
06/04/2026,Alexandre,Esfiha de carne,"R$ 12,00",30%
06/04/2026,Breno,Cookie de doce de leite,"R$ 21,90",50%
06/04/2026,Breno,Coca cola 350 ml,"R$ 10,00",50%
07/04/2026,Ariane,Coca cola 350 ml,"R$ 10,00",50%
07/04/2026,Alexandre,Cookie branco,"R$ 18,90",50%
07/04/2026,Alexandre,Cookie tradicional,"R$ 18,90",50%
08/04/2026,Alexandre,Cookie tradicional,"R$ 18,90",50%
08/04/2026,Alexandre,Cookie triple,"R$ 18,90",50%
08/04/2026,Alexandre,Cookie triple,"R$ 18,90",50%
08/04/2026,Alexandre,Latte grande,"R$ 16,00",30%
08/04/2026,Ana,Cookie triple,"R$ 18,90",50%
08/04/2026,Ana,limoneto,"R$ 10,00",50%
09/04/2026,Ana,Pão com geleia,"R$ 10,00",30%
09/04/2026,Ana,Cookie de cenoura,"R$ 27,00",50%
09/04/2026,Ana,Cookie branco,"R$ 18,90",50%
09/04/2026,Ana,Cookie triple,"R$ 18,90",50%
09/04/2026,Ana,cookie duplo,"R$ 18,90",50%
10/04/2026,Alexandre,2 x esfiha queijo,"R$ 24,00",30%
10/04/2026,Alexandre,Cookie pao de mel,,
10/04/2026,Ana,Pao com ovo cremoso,"R$ 28,00",30%
10/04/2026,Ariane,Cookie de cenoura,,
10/04/2026,Barbara,"Cookie red, duplo e doce",,
10/04/2026,Breno,Cookie de pistache,,
10/04/2026,Barbara,Cookie pão de mel,"R$ 27,00",50%
11/04/2026,Barbara,Pão de queijo de 6,"R$ 18,00",50%
13/04/2026,Ana,2 coxinhas de frango,"R$ 32,00",30%
13/04/2026,Ana,croissant presunto e queijo,"R$ 25,00",30%
13/04/2026,Ana,Pão de queijo de 6,"R$ 18,00",50%
13/04/2026,Ana,Cookie sandwich,"R$ 38,00",50%
13/04/2026,Ana,2 coxinhas de jaca,"R$ 34,00",30%
13/04/2026,Ana,Coca zero 220ml,"R$ 8,00",50%
14/04/2026,Alexandre,Cookie My way oreo,"R$ 27,00",50%
14/04/2026,Alexandre,Cookie my way kitkat,"R$ 27,00",50%
14/04/2026,Barbara,Yuba,"R$ 18,00",50%
15/04/2026,Alexandre,Yuba,"R$ 18,00",50%
15/04/2026,Alexandre,suco del vale,"R$ 9,00",50%
15/04/2026,Alexandre,2x pao de queijo com 6,"R$ 36,00",50%
15/04/2026,Alexandre, 2x limoneto,"R$ 20,00",50%
16/04/2026,Ariane,2x suco lata,"R$ 18,00",50%
16/04/2026,Ariane,cookie duplo,"R$ 18,90",50%
17/04/2026,Alexandre,Cookie triple,"R$ 18,90",50%
17/04/2026,Alexandre,Pão de queijo de 6,"R$ 18,00",50%
17/04/2026,Alexandre,H2O limoneto,"R$ 10,00",50%
17/04/2026,Alexandre,Cookie de cenoura,"R$ 27,00",50%
17/04/2026,Ariane,suco del vale,"R$ 9,00",50%
17/04/2026,Breno,Cookie triple,"R$ 18,90",50%
18/04/2026,Alexandre,Cookie triplo,"R$ 18,90",50%
18/04/2026,Ana,Cookie de doce de leite,"R$ 18,90",50%
18/04/2026,Ariane,esfiha de queijo,"R$ 12,00",30%
18/04/2026,Barbara,Coxinha de frango,"R$ 16,00",30%
20/04/2026,Alexandre,Pão de queijo de 6,"R$ 18,00",50%
21/04/2026,Alexandre,limoneto,"R$ 10,00",50%
21/04/2026,Alexandre,"torta, cheesecake e cookie",,
21/04/2026,Ariane,"torta, cheesecake e cookie",,
21/04/2026,Barbara,"torta, cheesecake e cookie",,
21/04/2026,Breno,2X MY WAY,"R$ 54,00",50%
22/04/2026,Alexandre,cookie triplo,"R$ 18,90",50%
22/04/2026,Alexandre,pao de queijo c/6,"R$ 18,00",50%
22/04/2026,Ariane,SUCO LATA,"R$ 9,00",50%
22/04/2026,Ariane,croissant presunto e queijo,"R$ 25,00",30%
22/04/2026,Keila,croissant presunto e queijo,"R$ 25,00",30%
23/04/2026,Ariane,Yuba,"R$ 18,00",50%
23/04/2026,Ariane,Pão de queijo de 6,"R$ 18,00",50%
23/04/2026,Ariane,Pancakes com 2 ,"R$ 20,00",50%
23/04/2026,Ariane,suco del vale,"R$ 9,00",50%
23/04/2026,Barbara,Pão com ovo,"R$ 28,00",30%
23/04/2026,Barbara,esfiha de queijo,"R$ 8,40",50%
23/04/2026,Breno,Cookie double,"R$ 18,90",50%
23/04/2026,Breno,esfiha de queijo,"R$ 8,40",50%
23/04/2026,Diogo,Limoneto,"R$ 10,00",50%
23/04/2026,Diogo,Torta de frango,"R$ 18,00",30%
23/04/2026,Diogo,Limoneto,"R$ 10,00",50%
24/04/2026,Ariane,COOKIE DOCE DE LEITE,"R$ 21,90",50%
25/04/2026,Ariane,2 x yuba,"R$ 36,00",50%
25/04/2026,Ariane,2X TORTA,"R$ 36,00",50%
25/04/2026,Ariane,PAO DE QUEIJO COM 6,"R$ 18,00",50%
25/04/2026,Ariane,SUCO LATA,"R$ 9,00",50%
25/04/2026,Keila,SUCO LATA,"R$ 9,00",50%
25/04/2026,Breno,pao de queijo,"R$ 18,00",50%
25/04/2026,Breno,BOLO CENOURA,"R$ 15,00",30%
25/04/2026,Diogo,My way,"R$ 27,00",50%
25/04/2026,Diogo,H2O limoneto,"R$ 10,00",50%
27/04/2026,Alexandre,Latte pequeno,"R$ 12,00",50%
28/04/2026,Ariane, PAO DE QUEIJO 3 UN,"R$ 11,00",50%
28/04/2026,Ariane,YUBA,"R$ 18,00",50%
28/04/2026,Ariane,Latte grande,"R$ 16,00",30%
28/04/2026,Ariane,SUCO LATA,"R$ 9,00",50%
28/04/2026,Barbara,YUBA,"R$ 18,00",50%
28/04/2026,Breno,Coca cola 350 ml,"R$ 10,00",50%
28/04/2026,Alexandre,suco del vale,"R$ 9,00",50%
28/04/2026,Alexandre,H2O limoneto,"R$ 10,00",50%
29/04/2026,Diogo,Yuba,"R$ 18,00",50%
30/04/2026,Breno,Coca cola 350 ml,"R$ 10,00",50%
30/04/2026,Breno,My way,"R$ 27,00",50%
30/04/2026,Breno,YUBA,"R$ 18,00",50%
30/04/2026,Breno,COOKIE MACADAMIA,"R$ 18,90",50%
30/04/2026,Barbara,COOKIE DOCE DE LEITE,"R$ 21,90",50%
01/05/2026,Ariane,2X COXINHA FRANGO,"R$ 32,00",30%
01/05/2026,Alexandre,Café espresso peq,"R$ 10,00",50%
01/05/2026,Barbara,latte pequeno,"R$ 12,00",50%
02/05/2026,Alexandre,BOLO CENOURA,"R$ 15,00",30%
02/05/2026,Alexandre,BOLO CHOCOLATE,"R$ 15,00",30%
02/05/2026,Alexandre,suco del vale,"R$ 9,00",50%
02/05/2026,Barbara,pao de queijo de 6,"R$ 18,00",50%
03/05/2026,Ariane,2X YUBA,"R$ 36,00",50%
03/05/2026,Alexandre,2X BOLO ,"R$ 30,00",30%
03/05/2026,Alexandre,SUCO LATA,"R$ 9,00",50%
03/05/2026,Alexandre,MY WAY,"R$ 27,00",50%
04/05/2026,Alexandre,suco lata,"R$ 9,00",50%
04/05/2026,Alexandre,Coxinha de frango,"R$ 16,00",30%
05/05/2026,Ariane,suco lata,"R$ 9,00",50%
05/05/2026,Diogo,H2O limoneto,"R$ 10,00",50%
05/05/2026,Diogo,COOKIE MACADAMIA,"R$ 18,90",50%
05/05/2026,Diogo,Cookie tradicional,"R$ 18,90",50%
05/05/2026,Diogo,cookie triplo,"R$ 18,90",50%
05/05/2026,Diogo,cookie dark,"R$ 27,00",50%
05/05/2026,Alexandre,MY WAY,"R$ 27,00",50%
06/05/2026,Breno,coca cola 350nml,"R$ 10,00",50%
06/05/2026,Breno,cookie macadamia,18.90,50%
06/05/2026,Ariane,COCA COLA 350,"R$ 10,00",50%
07/05/2026,Keila,Suco lata ,"R$ 9,00",50%
07/05/2026,Ariane,YUBA,"R$ 18,00",50%
07/05/2026,Ariane,suco lata pessego,"R$ 9,00",50%
07/05/2026,Barbara,croissant tradicional,"R$ 21,00",30%
08/05/2026,Ariane,suco lata pessego,"R$ 9,00",50%
08/05/2026,Alexandre,panqueca de 3 unidades,"R$ 24,00",50%
09/05/2026,Ariane,YUBA,"R$ 18,00",50%
09/05/2026,Ariane,YUBA,"R$ 18,00",50%
09/05/2026,Ariane,coca cola 350,"R$ 10,00",50%
09/05/2026,Barbara,H2O limoneto,"R$ 10,00",50%
09/05/2026,Alexandre,cookie triplo,"R$ 18,90",50%
10/05/2026,Breno,COCA COLA 350,"R$ 10,00",50%
10/05/2026,Breno,3 PAES DE QUEIJO,"R$ 0,00",0%
10/05/2026,Alexandre,MY WAY C/ MORANGO,"R$ 27,00",50%
10/05/2026,Alexandre,6 PÃES DE QUEIJO,"R$ 18,00",50%
10/05/2026,Alexandre,H2O limoneto,"R$ 10,00",50%
10/05/2026,Breno,COOKIE MACAdamia,"R$ 18,90",50%
10/05/2026,Alexandre,3 PAES DE QUEIJO,"R$ 0,00",50%
11/05/2026,Barbara,cookie duplo,"R$ 18,90",50%
12/05/2026,Ariane,latte pequeno,"R$ 12,00",50%
12/05/2026,Ariane,YUBA,"R$ 18,00",50%
12/05/2026,Ariane,bolo de milho,"R$ 15,00",30%
12/05/2026,Alexandre,bolo de cenoura,"R$ 15,00",30%
12/05/2026,Alexandre,bolo de cenoura,"R$ 15,00",30%
12/05/2026,Alexandre,coca cola 350,"R$ 10,00",50%
13/05/2026,Ariane,guarana 350 ml,"R$ 10,00",50%
13/05/2026,Keila,tortinha frango,"R$ 18,00",30%
13/05/2026,Keila,suco lata ,"R$ 9,00",50%
13/05/2026,Keila,YUBA,"R$ 18,00",50%
13/05/2026,Alexandre,Cookie tradicional,"R$ 18,90",50%
13/05/2026,Alexandre,cookie triplo,"R$ 18,90",50%
13/05/2026,Keila,Cookie kinder,"R$ 27,00",50%
14/05/2026,Ariane,chocolate cremoso grande,"R$ 18,00",50%
14/05/2026,Ariane,YUBA,"R$ 18,00",50%
14/05/2026,Ariane,Torta de frango,"R$ 18,00",30%
14/05/2026,Breno,2x macadamia,"R$ 37,80",50%
14/05/2026,Ariane,chocolate cremoso grande,"R$ 18,00",50%
14/05/2026,Keila,Quiche,"R$ 18,00",30%
14/05/2026,Keila,cookie chocolate branco,"R$ 18,90",50%
14/05/2026,Keila,cinnamon tradicional,"R$ 27,00",50%
15/05/2026,Keila,2x yuba,"R$ 36,00",50%
15/05/2026,Keila,suco lata,"R$ 9,00",50%
15/05/2026,Ariane,suco lata,"R$ 9,00",50%
15/05/2026,Ariane,2x yuba,"R$ 36,00",50%
15/05/2026,Alexandre,2x yuba,"R$ 36,00",50%
15/05/2026,Ariane,YUBA,"R$ 18,00",50%
15/05/2026,Alexandre,H2O Limoneto,"R$ 10,00",50%
15/05/2026,Barbara,3 paes de queijo,"R$ 11,00",50%
15/05/2026,Keila,2x yuba,"R$ 36,00",50%
16/05/2026,Barbara,Coxinha de frango,"R$ 16,00",30%
16/05/2026,Keila,suco lata,"R$ 9,00",50%
16/05/2026,Alexandre,H2O Limoneto,"R$ 10,00",50%`;

async function importData() {
  const lines = csvData.split('\n').filter(line => line.trim() !== '');
  const headers = lines[0].split(',');
  
  console.log(`Starting import of ${lines.length - 1} records...`);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Handle quoted values with commas (e.g., "R$ 10,00")
    const parts = [];
    let currentPart = '';
    let inQuotes = false;
    for (let char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) {
        parts.push(currentPart);
        currentPart = '';
      } else {
        currentPart += char;
      }
    }
    parts.push(currentPart);

    const [rawDate, funcionario, item, rawValor, rawDesconto] = parts;

    // Format date DD/MM/YYYY -> YYYY-MM-DD
    const dateParts = rawDate.split('/');
    if (dateParts.length !== 3) continue;
    const date = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

    // Format valor "R$ 10,00" -> 10.00
    const valorCheio = parseFloat(rawValor.replace('R$ ', '').replace(',', '.')) || 0;

    // Format desconto "50%" -> 50
    const descontoPercent = parseFloat(rawDesconto.replace('%', '')) || 0;

    const valorPago = valorCheio * (1 - descontoPercent / 100);

    const record = {
      data: date,
      funcionario: funcionario.trim(),
      produto: item.trim(),
      valorCheio: valorCheio,
      descontoPercent: descontoPercent,
      valorPago: valorPago,
      status: 'pendente',
      userId: 'shared_franquia_data',
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, `users/shared_franquia_data/staffConsumption`), record);
      console.log(`[${i}] Imported: ${funcionario} - ${item}`);
    } catch (err) {
      console.error(`Error importing record ${i}:`, err);
    }
  }

  console.log('Finished import.');
  process.exit(0);
}

importData();
