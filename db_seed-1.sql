
-- ============================================================
-- PART 1: SCHEMA & BRAZILIAN MOVIES
-- ============================================================

-- NOTE: Ensure db_seed.sql is run first to create 'legacy_movies_sink' view

INSERT INTO public.legacy_movies_sink (
    "id", "title", "titlePt", "originalTitle", 
    "description", "descriptionPt", "descriptionHi", "descriptionRu", "descriptionIt",
    "genres", "year", "language", "hasSubtitles", 
    "posterUrl", "videoUrl", "trailerUrl", "rating", "duration", 
    "director", "type", "sourceLabel", "cast_members", "awards"
) VALUES 
(
    'br-01', 'Hello, Hello Carnival!', 'Alô, Alô, Carnaval!', 'Alô, Alô, Carnaval!',
    'A classic Brazilian musical comedy featuring the legendary Carmen Miranda and Aurora Miranda. The film captures the vibrant spirit of Rio''s carnival in the 1930s.',
    'Uma comédia musical clássica com as lendárias Carmen Miranda e Aurora Miranda. O filme captura o espírito vibrante do carnaval carioca dos anos 30.',
    'कारमेन मिरांडा और अरोरा मिरांडा की विशेषता वाली एक क्लासिक ब्राजीलियाई संगीतमय कॉमेडी। यह फिल्म 1930 के दशक में रियो के कार्निवल की जीवंत भावना को दर्शाती है।',
    'Классическая бразильская музыкальная комедия с участием легендарных Кармен Миранда и Авроры Миранда. Фильм передает яркий дух карнавала в Рио 1930-х годов.',
    'Una classica commedia musicale brasiliana con le leggendarie Carmen Miranda e Aurora Miranda. Il film cattura lo spirito vibrante del carnevale di Rio negli anni ''30.',
    ARRAY['Musical', 'Comedy'], 1936, 'Portuguese', false, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Al%C3%B4_Al%C3%B4_Carnaval_poster.jpg/400px-Al%C3%B4_Al%C3%B4_Carnaval_poster.jpg', 
    'https://archive.org/download/alo-alo-carnaval-1936/Al%C3%B4%20Al%C3%B4%20Carnaval%20%281936%29.mp4', 
    'https://www.youtube.com/watch?v=2Z2Z2Z2Z2Z2', '7.0', '1h 15m', 
    'Adhemar Gonzaga', 'Movie', 'BNDigital', ARRAY['Carmen Miranda', 'Aurora Miranda'], ARRAY['Cinédia Classic']
),
(
    'br-02', 'Suckers No More', 'Acabaram-se os Otários', 'Acabaram-se os Otários',
    'Considered the first sound film produced in Brazil. A comedy about two caipiras trying to survive in the big city.',
    'Considerado o primeiro filme sonoro produzido no Brasil. Uma comédia sobre dois caipiras tentando sobreviver na cidade grande.',
    'ब्राजील में निर्मित पहली ध्वनि फिल्म मानी जाती है। बड़े शहर में जीवित रहने की कोशिश कर रहे दो ग्रामीणों के बारे में एक कॉमेडी।',
    'Считается первым звуковым фильмом, снятым в Бразилии. Комедия о двух деревенщинах, пытающихся выжить в большом городе.',
    'Considerato il primo film sonoro prodotto in Brasile. Una commedia su due contadini che cercano di sopravvivere nella grande città.',
    ARRAY['Comedy'], 1929, 'Portuguese', false, 
    'https://upload.wikimedia.org/wikipedia/pt/thumb/2/23/Acabaram-se_os_Ot%C3%A1rios.jpg/250px-Acabaram-se_os_Ot%C3%A1rios.jpg', 
    'https://archive.org/download/acabaram-se-os-otarios-1929/Acabaram-se%20os%20ot%C3%A1rios%20%281929%29.mp4', 
    NULL, '6.2', '1h 10m', 'Luiz de Barros', 'Movie', 'Domínio Público', ARRAY['Genésio Arruda', 'Tom Bill'], ARRAY['Historical Landmark']
),
(
    'br-03', 'Limit', 'Limite', 'Limite',
    'A masterpiece of Brazilian silent cinema and avant-garde. A man and two women drift in a small boat, lost in their memories.',
    'Uma obra-prima do cinema mudo brasileiro e da vanguarda. Um homem e duas mulheres vagam em um pequeno barco, perdidos em suas memórias.',
    'ब्राजीलियाई मूक सिनेमा और अवंत-गार्डे की एक उत्कृष्ट कृति। एक आदमी और दो महिलाएं एक छोटी नाव में बहते हैं, अपनी यादों में खोए हुए।',
    'Шедевр бразильского немого кино и авангарда. Мужчина и две женщины дрейфуют в маленькой лодке, погруженные в свои воспоминания.',
    'Un capolavoro del cinema muto brasiliano e d''avanguardia. Un uomo e due donne vanno alla deriva in una piccola barca, persi nei loro ricordi.',
    ARRAY['Drama', 'Experimental'], 1931, 'Silent', false, 
    'https://upload.wikimedia.org/wikipedia/pt/thumb/8/85/Limite_filme.jpg/230px-Limite_filme.jpg', 
    'https://archive.org/download/Limite_1931/Limite.mp4', 
    NULL, '8.1', '2h 0m', 'Mário Peixoto', 'Movie', 'BNDigital', ARRAY['Olga Breno', 'Tacito Rocha'], ARRAY['Best Brazilian Film']
),
(
    'br-04', 'Ganga Bruta', 'Ganga Bruta', 'Ganga Bruta',
    'A wealthy engineer kills his wife on their wedding night and tries to rebuild his life in a new town. Considered Humberto Mauro''s masterpiece.',
    'Um engenheiro rico mata a esposa na noite de núpcias e tenta reconstruir a vida em uma nova cidade. Considerada a obra-prima de Humberto Mauro.',
    'एक अमीर इंजीनियर अपनी शादी की रात अपनी पत्नी को मार डालता है और एक नए शहर में अपना जीवन फिर से बनाने की कोशिश करता है। हम्बर्टो मौरो की उत्कृष्ट कृति मानी जाती है।',
    'Богатый инженер убивает свою жену в первую брачную ночь и пытается начать новую жизнь в другом городе. Считается шедевром Умберто Мауро.',
    'Un ricco ingegnere uccide la moglie la prima notte di nozze e cerca di rifarsi una vita in una nuova città. Considerato il capolavoro di Humberto Mauro.',
    ARRAY['Drama', 'Thriller'], 1933, 'Portuguese', false, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Ganga_Bruta.jpg/400px-Ganga_Bruta.jpg', 
    'https://archive.org/download/ganga-bruta-1933/Ganga%20Bruta%20%281933%29.mp4', 
    NULL, '7.4', '1h 22m', 'Humberto Mauro', 'Movie', 'Cinédia', ARRAY['Durval Bellini', 'Déa Selva'], ARRAY['Best Film (UNESCO List)']
),
(
    'br-05', 'The Drunkard', 'O Ébrio', 'O Ébrio',
    'A generous man is betrayed by his family and friends, loses his fortune, and wanders the streets as a drunkard. Based on the famous song.',
    'Um homem generoso é traído por família e amigos, perde sua fortuna e vaga pelas ruas como um ébrio. Baseado na famosa canção de Vicente Celestino.',
    'एक उदार व्यक्ति को उसके परिवार और दोस्तों द्वारा धोखा दिया जाता है, वह अपनी संपत्ति खो देता है, और एक शराबी के रूप में सड़कों पर भटकता है।',
    'Щедрого человека предают семья и друзья, он теряет свое состояние и бродит по улицам как пьяница. Основано на известной песне.',
    'Un uomo generoso viene tradito dalla famiglia e dagli amici, perde la sua fortuna e vaga per le strade come un ubriacone. Basato sulla famosa canzone.',
    ARRAY['Drama', 'Musical'], 1946, 'Portuguese', false, 
    'https://upload.wikimedia.org/wikipedia/pt/thumb/2/23/O_Ebrio_cartaz.jpg/240px-O_Ebrio_cartaz.jpg', 
    'https://archive.org/download/o-ebrio-1946/O%20%C3%89brio%20%281946%29.mp4', 
    NULL, '7.1', '2h 5m', 'Gilda de Abreu', 'Movie', 'Cinédia', ARRAY['Vicente Celestino'], ARRAY['Box Office Record']
),
(
    'br-06', 'Silk Doll', 'Bonequinha de Seda', 'Bonequinha de Seda',
    'A classic Brazilian comedy about a young woman who pretends to be wealthy to enter high society.',
    'Uma comédia clássica brasileira sobre uma jovem que finge ser rica para entrar na alta sociedade.',
    'एक क्लासिक ब्राजीलियाई कॉमेडी एक युवा महिला के बारे में जो उच्च समाज में प्रवेश करने के लिए अमीर होने का नाटक करती है।',
    'Классическая бразильская комедия о молодой женщине, которая притворяется богатой, чтобы войти в высшее общество.',
    'Una classica commedia brasiliana su una giovane donna che finge di essere ricca per entrare nell''alta società.',
    ARRAY['Comedy', 'Romance'], 1936, 'Portuguese', false, 
    'https://upload.wikimedia.org/wikipedia/pt/thumb/d/d4/Bonequinha_de_Seda.jpg/230px-Bonequinha_de_Seda.jpg', 
    'https://archive.org/download/bonequinha-de-seda-1936/Bonequinha%20de%20Seda%20%281936%29.mp4', 
    NULL, '6.8', '1h 30m', 'Oduvaldo Vianna', 'Movie', 'Cinédia', ARRAY['Gilda de Abreu'], ARRAY[]::text[]
),
(
    'br-07', 'The Discovery of Brazil', 'O Descobrimento do Brasil', 'O Descobrimento do Brasil',
    'A historical epic depicting the voyage of Pedro Álvares Cabral and the discovery of Brazil, featuring music by Heitor Villa-Lobos.',
    'Um épico histórico retratando a viagem de Pedro Álvares Cabral e o descobrimento do Brasil, com música de Heitor Villa-Lobos.',
    'पेड्रो अल्वारेस कैब्राल की यात्रा और ब्राजील की खोज का चित्रण करने वाला एक ऐतिहासिक महाकाव्य, जिसमें हीटर विला-लोबोस का संगीत है।',
    'Историческая эпопея, изображающая путешествие Педру Алвареша Кабрала и открытие Бразилии, с музыкой Эйтора Вилла-Лобоса.',
    'Un''epopea storica che descrive il viaggio di Pedro Álvares Cabral e la scoperta del Brasile, con musiche di Heitor Villa-Lobos.',
    ARRAY['History', 'Adventure'], 1937, 'Portuguese', false, 
    'https://upload.wikimedia.org/wikipedia/pt/thumb/6/6c/O_Descobrimento_do_Brasil.jpg/240px-O_Descobrimento_do_Brasil.jpg', 
    'https://archive.org/download/o-descobrimento-do-brasil-1937/O%20Descobrimento%20do%20Brasil%20%281937%29.mp4', 
    NULL, '7.0', '1h 22m', 'Humberto Mauro', 'Movie', 'Instituto Humberto Mauro', ARRAY['Alvaro Costa'], ARRAY['Venice Film Festival Nominee']
),
(
    'br-08', 'Aitaré of the Beach', 'Aitaré da Praia', 'Aitaré da Praia',
    'A silent masterpiece from the Recife Cycle. A fisherman saves a wealthy woman from a shark attack and faces social conflict.',
    'Uma obra-prima muda do Ciclo do Recife. Um pescador salva uma mulher rica de um ataque de tubarão e enfrenta conflitos sociais.',
    'Recife साइकिल से एक मूक उत्कृष्ट कृति। एक मछुआरा एक अमीर महिला को शार्क के हमले से बचाता है और सामाजिक संघर्ष का सामना करता है।',
    'Немой шедевр из цикла Ресифи. Рыбак спасает богатую женщину от нападения акулы и сталкивается с социальным конфликтом.',
    'Un capolavoro muto del Ciclo di Recife. Un pescatore salva una donna ricca dall''attacco di uno squalo e affronta un conflitto sociale.',
    ARRAY['Drama', 'Silent', 'Action'], 1925, 'Silent', false, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Aitar%C3%A9_da_Praia.jpg/400px-Aitar%C3%A9_da_Praia.jpg', 
    'https://archive.org/download/aitare-da-praia-1925/Aitar%C3%A9%20da%20Praia%20%281925%29.mp4', 
    NULL, '7.2', '1h 5m', 'Gentil Roiz', 'Movie', 'Ciclo do Recife', ARRAY['Ary Severo'], ARRAY[]::text[]
),
(
    'br-09', 'Minas Conspiracy', 'Inconfidência Mineira', 'Inconfidência Mineira',
    'A historical drama about the 18th-century movement for Brazilian independence from Portugal.',
    'Um drama histórico sobre o movimento do século 18 pela independência do Brasil de Portugal, produzido por Carmen Santos.',
    'पुर्तगाल से ब्राजील की स्वतंत्रता के लिए 18वीं सदी के आंदोलन के बारे में एक ऐतिहासिक नाटक।',
    'Историческая драма о движении XVIII века за независимость Бразилии от Португалии.',
    'Un dramma storico sul movimento del XVIII secolo per l''indipendenza brasiliana dal Portogallo.',
    ARRAY['History', 'Drama'], 1948, 'Portuguese', false, 
    'https://upload.wikimedia.org/wikipedia/pt/thumb/d/d6/Inconfid%C3%AAncia_Mineira_%28filme%29.jpg/250px-Inconfid%C3%AAncia_Mineira_%28filme%29.jpg', 
    'https://archive.org/download/inconfidencia-mineira-1948/Inconfid%C3%AAncia%20Mineira%20%281948%29.mp4', 
    NULL, '6.5', '1h 50m', 'Carmen Santos', 'Movie', 'Brasil Vita Filmes', ARRAY['Rodolfo Mayer'], ARRAY[]::text[]
),
(
    'br-10', 'O Guarani', 'O Guarani', 'O Guarani',
    'One of the first film adaptations of José de Alencar''s novel. A foundational work of Brazilian silent cinema.',
    'Uma das primeiras adaptações cinematográficas do romance de José de Alencar. Uma obra fundamental do cinema mudo brasileiro.',
    'जोस डी अलेंकर के उपन्यास के पहले फिल्म रूपांतरणों में से एक। ब्राजीलियाई मूक सिनेमा का एक मूलभूत कार्य।',
    'Одна из первых экранизаций романа Жозе де Аленкара. Основополагающая работа бразильского немого кино.',
    'Uno dei primi adattamenti cinematografici del romanzo di José de Alencar. Un''opera fondamentale del cinema muto brasiliano.',
    ARRAY['Drama', 'History', 'Silent'], 1916, 'Silent', false, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/O_Guarani_1916.jpg/300px-O_Guarani_1916.jpg', 
    NULL, 
    NULL, '6.5', '1h 5m', 'Vittorio Capellaro', 'Movie', 'Public Domain', ARRAY['Vittorio Capellaro'], ARRAY[]::text[]
),
(
    'br-11', 'Diamond Hunter', 'O Caçador de Diamantes', 'O Caçador de Diamantes',
    'An adventure film directed by Vittorio Capellaro, focusing on the search for precious stones in the interior of Brazil.',
    'Um filme de aventura dirigido por Vittorio Capellaro, focado na busca por pedras preciosas no interior do Brasil.',
    'विटोरियो कैपेलारो द्वारा निर्देशित एक साहसिक फिल्म, जो ब्राजील के आंतरिक भाग में कीमती पत्थरों की खोज पर केंद्रित है।',
    'Приключенческий фильм режиссера Витторио Капелларо, посвященный поиску драгоценных камней в глубине Бразилии.',
    'Un film d''avventura diretto da Vittorio Capellaro, incentrato sulla ricerca di pietre preziose all''interno del Brasile.',
    ARRAY['Adventure'], 1934, 'Portuguese', false, 
    'https://placehold.co/400x600/333/FFF?text=Cacador+Diamantes', 
    NULL, 
    NULL, '6.0', '1h 10m', 'Vittorio Capellaro', 'Movie', 'Public Domain', ARRAY['Corita Coimbra'], ARRAY[]::text[]
),
(
    'br-12', 'Students', 'Estudantes', 'Estudantes',
    'A musical romance produced by Carmen Santos, featuring the student life in Rio de Janeiro.',
    'Um romance musical produzido por Carmen Santos, retratando a vida estudantil no Rio de Janeiro.',
    'कारमेन सैंटोस द्वारा निर्मित एक संगीतमय रोमांस, जिसमें रियो डी जनेरियो में छात्र जीवन को दिखाया गया है।',
    'Музыкальный роман, спродюсированный Кармен Сантос, о студенческой жизни в Рио-де-Жанейро.',
    'Una storia d''amore musicale prodotta da Carmen Santos, con la vita studentesca a Rio de Janeiro.',
    ARRAY['Musical', 'Romance'], 1935, 'Portuguese', false, 
    'https://upload.wikimedia.org/wikipedia/pt/thumb/2/2e/Estudantes_filme.jpg/250px-Estudantes_filme.jpg', 
    'https://archive.org/download/Estudantes1935/Estudantes%20%281935%29.mp4', 
    NULL, '6.3', '1h 15m', 'Wallace Downey', 'Movie', 'Cinédia', ARRAY['Carmen Santos', 'Barbosa Júnior'], ARRAY[]::text[]
),
(
    'br-13', 'The Day is Ours', 'O Dia é Nosso', 'O Dia é Nosso',
    'A rare film directed by Milton Rodrigues, showcasing the urban drama of the 1940s.',
    'Um filme raro dirigido por Milton Rodrigues, mostrando o drama urbano da década de 1940.',
    'मिल्टन रोड्रिग्स द्वारा निर्देशित एक दुर्लभ फिल्म, जो 1940 के दशक के शहरी नाटक को प्रदर्शित करती है।',
    'Редкий фильм режиссера Милтона Родригеса, демонстрирующий городскую драму 1940-х годов.',
    'Un film raro diretto da Milton Rodrigues, che mostra il dramma urbano degli anni ''40.',
    ARRAY['Drama'], 1941, 'Portuguese', false, 
    'https://placehold.co/400x600/444/FFF?text=O+Dia+E+Nosso', 
    NULL, 
    NULL, '6.0', '1h 20m', 'Milton Rodrigues', 'Movie', 'Public Domain', ARRAY['Oscarito'], ARRAY[]::text[]
),
(
    'br-14', 'Moleque Tião', 'Moleque Tião', 'Moleque Tião',
    'Based on the life of the famous black clown Grande Otelo, this film is a landmark in Brazilian cinema dealing with race and art.',
    'Baseado na vida do famoso palhaço negro Grande Otelo, este filme é um marco no cinema brasileiro ao tratar de raça e arte.',
    'प्रसिद्ध अश्वेत जोकर ग्रांडे ओटेलो के जीवन पर आधारित, यह फिल्म नस्ल और कला से संबंधित ब्राजीलियाई सिनेमा में एक मील का पत्थर है।',
    'Основанный на жизни знаменитого чернокожего клоуна Гранди Отелу, этот фильм является вехой в бразильском кино, посвященном расе и искусству.',
    'Basato sulla vita del famoso clown nero Grande Otelo, questo film è una pietra miliare del cinema brasiliano che tratta di razza e arte.',
    ARRAY['Drama', 'Biography'], 1943, 'Portuguese', false, 
    'https://upload.wikimedia.org/wikipedia/pt/thumb/5/52/Moleque_Ti%C3%A3o.jpg/240px-Moleque_Ti%C3%A3o.jpg', 
    NULL, 
    NULL, '7.5', '1h 44m', 'José Carlos Burle', 'Movie', 'Atlântida', ARRAY['Grande Otelo'], ARRAY[]::text[]
),
(
    'br-15', 'Berlin in the Batucada', 'Berlim na Batucada', 'Berlim na Batucada',
    'A satire produced during WWII, imagining Nazi figures getting involved with Brazilian samba.',
    'Uma sátira produzida durante a Segunda Guerra Mundial, imaginando figuras nazistas se envolvendo com o samba brasileiro.',
    'द्वितीय विश्व युद्ध के दौरान निर्मित एक व्यंग्य, जिसमें नाजी शख्सियतों को ब्राजीलियाई सांबा के साथ शामिल होने की कल्पना की गई है।',
    'Сатира, созданная во время Второй мировой войны, представляющая нацистских деятелей, вовлекающихся в бразильскую самбу.',
    'Una satira prodotta durante la seconda guerra mondiale, che immagina figure naziste coinvolte nel samba brasiliano.',
    ARRAY['Comedy', 'Musical'], 1944, 'Portuguese', false, 
    'https://placehold.co/400x600/555/FFF?text=Berlim+Batucada', 
    NULL, 
    NULL, '6.0', '1h 10m', 'Luiz de Barros', 'Movie', 'Cinédia', ARRAY['Procópio Ferreira'], ARRAY[]::text[]
),
(
    'br-16', 'The Slum', 'O Cortiço', 'O Cortiço',
    'Adaptation of the naturalist novel by Aluísio Azevedo, exploring the harsh realities of tenement life in Rio.',
    'Adaptação do romance naturalista de Aluísio Azevedo, explorando as duras realidades da vida nos cortiços do Rio.',
    'अलुइसियो अज़ेवेडो के प्रकृतिवादी उपन्यास का रूपांतरण, रियो में किराये के जीवन की कठोर वास्तविकताओं की खोज।',
    'Экранизация натуралистического романа Алуизио Азеведо, исследующая суровые реалии жизни в многоквартирных домах Рио.',
    'Adattamento del romanzo naturalista di Aluísio Azevedo, che esplora le dure realtà della vita nei condomini di Rio.',
    ARRAY['Drama'], 1945, 'Portuguese', false, 
    'https://upload.wikimedia.org/wikipedia/pt/thumb/d/d4/O_corti%C3%A7o_1945.jpg/200px-O_corti%C3%A7o_1945.jpg', 
    NULL, 
    NULL, '6.8', '1h 30m', 'Luiz de Barros', 'Movie', 'Public Domain', ARRAY['Horacina Corrêa'], ARRAY[]::text[]
),
(
    'br-17', 'Carnival in Fire', 'Carnaval no Fogo', 'Carnaval no Fogo',
    'A classic chanchada (musical comedy) featuring the iconic duo Oscarito and Grande Otelo.',
    'Uma chanchada clássica com a icônica dupla Oscarito e Grande Otelo.',
    'एक क्लासिक चंचादा (संगीतमय कॉमेडी) जिसमें प्रतिष्ठित जोड़ी ऑस्करिटो और ग्रांडे ओटेलो शामिल हैं।',
    'Классическая чанчада (музыкальная комедия) с участием культового дуэта Оскарито и Гранди Отелу.',
    'Una classica chanchada (commedia musicale) con l''iconico duo Oscarito e Grande Otelo.',
    ARRAY['Comedy', 'Musical'], 1949, 'Portuguese', false, 
    'https://upload.wikimedia.org/wikipedia/pt/thumb/8/8e/Carnaval_no_Fogo.jpg/230px-Carnaval_no_Fogo.jpg', 
    'https://archive.org/download/carnaval-no-fogo-1949/Carnaval%20no%20Fogo%20%281949%29.mp4', 
    NULL, '7.3', '1h 30m', 'Watson Macedo', 'Movie', 'Atlântida', ARRAY['Oscarito', 'Grande Otelo'], ARRAY['Box Office Hit']
),
(
    'br-18', '24 Hours of Dream', '24 Horas de Sonho', '24 Horas de Sonho',
    'A comedy directed by Chianca de Garcia, typical of the light entertainment of the period.',
    'Uma comédia dirigida por Chianca de Garcia, típica do entretenimento leve do período.',
    'चियानका डी गार्सिया द्वारा निर्देशित एक कॉमेडी, जो उस समय के हल्के मनोरंजन की विशिष्ट है।',
    'Комедия режиссера Шанка де Гарсия, типичная для легкого развлечения того периода.',
    'Una commedia diretta da Chianca de Garcia, tipica dell''intrattenimento leggero dell''epoca.',
    ARRAY['Comedy'], 1941, 'Portuguese', false, 
    'https://placehold.co/400x600/666/FFF?text=24+Horas', 
    NULL, 
    NULL, '5.5', '1h 15m', 'Chianca de Garcia', 'Movie', 'Cinédia', ARRAY['Dulce Damasceno'], ARRAY[]::text[]
),
(
    'br-19', 'Pure Beauty', 'A Beleza do Diabo', 'A Beleza do Diabo',
    'An early film produced by Cinédia studio, directed by Romain Lesage.',
    'Um filme antigo produzido pelo estúdio Cinédia, dirigido por Romain Lesage.',
    'रोमेन लेसेज द्वारा निर्देशित सिनेडिया स्टूडियो द्वारा निर्मित एक प्रारंभिक फिल्म।',
    'Ранний фильм, снятый студией Cinédia, режиссер Ромен Лесаж.',
    'Un primo film prodotto dallo studio Cinédia, diretto da Romain Lesage.',
    ARRAY['Drama'], 1950, 'Portuguese', false, 
    'https://placehold.co/400x600/777/FFF?text=Beleza+Diabo', 
    NULL, 
    NULL, '6.0', '1h 20m', 'Romain Lesage', 'Movie', 'Cinédia', ARRAY['Mirian Lacy'], ARRAY[]::text[]
),
(
    'br-20', 'The Buyer of Farms', 'O Comprador de Fazendas', 'O Comprador de Fazendas',
    'A classic comedy starring Procópio Ferreira, based on a book by Monteiro Lobato.',
    'Uma comédia clássica estrelada por Procópio Ferreira, baseada em um livro de Monteiro Lobato.',
    'मोंटेइरो लोबाटो की एक किताब पर आधारित प्रोकोपियो फरेरा अभिनीत एक क्लासिक कॉमेडी।',
    'Классическая комедия с Прокопио Феррейрой в главной роли, основанная на книге Монтейру Лобату.',
    'Una commedia classica con Procópio Ferreira, basata su un libro di Monteiro Lobato.',
    ARRAY['Comedy'], 1951, 'Portuguese', false, 
    'https://placehold.co/400x600/888/FFF?text=Comprador+Fazendas', 
    NULL, 
    NULL, '7.0', '1h 30m', 'Alberto Pieralisi', 'Movie', 'Cinédia', ARRAY['Procópio Ferreira'], ARRAY[]::text[]
);
