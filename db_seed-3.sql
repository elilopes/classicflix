-- ============================================================
-- PART 3: US PUBLIC DOMAIN MOVIES (M-Z)
-- ============================================================

INSERT INTO public.movies (
    "id", "title", "titlePt", "originalTitle", 
    "description", "descriptionPt", "descriptionHi", "descriptionRu", "descriptionIt",
    "genres", "year", "language", "hasSubtitles", 
    "posterUrl", "videoUrl", "trailerUrl", "rating", "duration", 
    "director", "type", "sourceLabel", "cast_members", "awards"
) VALUES 

(
    'us-n01', 'Nothing Sacred', 'Nada é Sagrado', 'Nothing Sacred',
    'A screwball comedy about a woman diagnosed with radium poisoning who becomes a media darling, only to discover she isn''t dying.',
    'Uma comédia maluca sobre uma mulher diagnosticada com envenenamento por rádio que se torna uma queridinha da mídia, apenas para descobrir que não está morrendo.',
    'रेडियम विषाक्तता के निदान वाली एक महिला के बारे में एक स्क्रूबॉल कॉमेडी जो एक मीडिया डार्लिंग बन जाती है, केवल यह पता लगाने के लिए कि वह नहीं मर रही है।',
    'Эксцентричная комедия о женщине, у которой диагностировали отравление радием, которая становится любимицей СМИ, но обнаруживает, что она не умирает.',
    'Una commedia eccentrica su una donna a cui è stato diagnosticato un avvelenamento da radio che diventa una beniamina dei media, solo per scoprire che non sta morendo.',
    ARRAY['Comedy', 'Romance'], 1937, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Nothing_Sacred_poster.jpg/400px-Nothing_Sacred_poster.jpg', 
    'https://archive.org/download/NothingSacred1937/NothingSacred1937.mp4', 
    NULL, '7.0', '1h 17m', 'William A. Wellman', 'Movie', 'Archive.org', ARRAY['Carole Lombard'], ARRAY['Technicolor Classic']
),
(
    'us-o01', 'Our Town', 'Nossa Cidade', 'Our Town',
    'Film adaptation of Thornton Wilder''s play about life, love and death in a small American town.',
    'Adaptação cinematográfica da peça de Thornton Wilder sobre vida, amor e morte em uma pequena cidade americana.',
    'एक छोटे से अमेरिकी शहर में जीवन, प्रेम और मृत्यु के बारे में थोरंटन वाइल्डर के नाटक का फिल्म रूपांतरण।',
    'Экранизация пьесы Торнтона Уайлдера о жизни, любви и смерти в маленьком американском городке.',
    'Adattamento cinematografico dell''opera di Thornton Wilder sulla vita, l''amore e la morte in una piccola città americana.',
    ARRAY['Drama'], 1940, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Our_Town_%281940_poster%29.jpg/400px-Our_Town_%281940_poster%29.jpg', 
    NULL, 
    NULL, '7.6', '1h 30m', 'Sam Wood', 'Movie', 'Public Domain', ARRAY['William Holden'], ARRAY['Oscar Nominee']
),
(
    'us-p01', 'Penny Serenade', 'Serenata Prateada', 'Penny Serenade',
    'A couple looks back on their past as they prepare to adopt a child. A tear-jerker classic.',
    'Um casal relembra seu passado enquanto se prepara para adotar uma criança. Um clássico de chorar.',
    'एक जोड़े अपने अतीत को देखता है क्योंकि वे एक बच्चे को गोद लेने की तैयारी करते हैं। एक आंसू-झटका क्लासिक।',
    'Пара оглядывается на свое прошлое, готовясь усыновить ребенка. Классическая слезливая мелодрама.',
    'Una coppia guarda al proprio passato mentre si prepara ad adottare un bambino. Un classico strappalacrime.',
    ARRAY['Drama', 'Romance'], 1941, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Penny_Serenade_poster.jpg/400px-Penny_Serenade_poster.jpg', 
    'https://archive.org/download/PennySerenade/PennySerenade.mp4', 
    NULL, '7.1', '1h 59m', 'George Stevens', 'Movie', 'Archive.org', ARRAY['Cary Grant', 'Irene Dunne'], ARRAY['Oscar Nominee']
),
(
    'us-q01', 'Quicksand', 'Areias Movediças', 'Quicksand',
    'A mechanic steals money to go on a date, leading him down a spiral of crime.',
    'Um mecânico rouba dinheiro para ir a um encontro, levando-o a uma espiral de crimes.',
    'एक मैकेनिक डेट पर जाने के लिए पैसे चुराता है, जिससे वह अपराध के सर्पिल में चला जाता है।',
    'Механик крадет деньги, чтобы пойти на свидание, что ведет его по спирали преступлений.',
    'Un meccanico ruba dei soldi per andare a un appuntamento, portandolo in una spirale di crimini.',
    ARRAY['Noir', 'Crime'], 1950, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Quicksand_%281950_poster%29.jpg/400px-Quicksand_%281950_poster%29.jpg', 
    NULL, 
    NULL, '7.0', '1h 19m', 'Irving Pichel', 'Movie', 'Public Domain', ARRAY['Mickey Rooney'], ARRAY[]::text[]
),
(
    'us-r01', 'Rain', 'O Pecado de Madelon Claudet', 'Rain',
    'A missionary tries to reform a prostitute on a South Pacific island, but falls prey to temptation.',
    'Um missionário tenta reformar uma prostituta em uma ilha do Pacífico Sul, mas cai em tentação.',
    'एक मिशनरी दक्षिण प्रशांत द्वीप पर एक वेश्या को सुधारने की कोशिश करता है, लेकिन प्रलोभन का शिकार हो जाता है।',
    'Миссионер пытается исправить проститутку на острове в южной части Тихого океана, но поддается искушению.',
    'Un missionario cerca di riformare una prostituta su un''isola del Pacifico meridionale, ma cade preda della tentazione.',
    ARRAY['Drama'], 1932, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Rain_poster.jpg/400px-Rain_poster.jpg', 
    'https://archive.org/download/Rain1932/Rain1932.mp4', 
    NULL, '6.6', '1h 34m', 'Lewis Milestone', 'Movie', 'Archive.org', ARRAY['Joan Crawford'], ARRAY[]::text[]
),
(
    'us-r02', 'Road to Bali', 'O Caminho de Bali', 'Road to Bali',
    'Bob Hope and Bing Crosby dive for treasure and compete for Dorothy Lamour in the only color "Road" movie.',
    'Bob Hope e Bing Crosby mergulham em busca de tesouros e competem por Dorothy Lamour no único filme "Road" colorido.',
    'बॉब होप और बिंग क्रॉसबी खजाने के लिए गोता लगाते हैं और एकमात्र रंगीन "रोड" फिल्म में डोरोथी लैमौर के लिए प्रतिस्पर्धा करते हैं।',
    'Боб Хоуп и Бинг Кросби ныряют за сокровищами и соревнуются за Дороти Ламур в единственном цветном фильме «Дорога».',
    'Bob Hope e Bing Crosby si tuffano per il tesoro e competono per Dorothy Lamour nell''unico film "Road" a colori.',
    ARRAY['Comedy', 'Musical'], 1952, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Road_to_Bali_poster.jpg/400px-Road_to_Bali_poster.jpg', 
    'https://archive.org/download/RoadToBali/RoadToBali.mp4', 
    NULL, '6.7', '1h 31m', 'Hal Walker', 'Movie', 'Archive.org', ARRAY['Bob Hope', 'Bing Crosby'], ARRAY[]::text[]
),
(
    'us-s01', 'Second Chorus', 'Dois em Uma', 'Second Chorus',
    'Two trumpeters compete for a job with Artie Shaw''s band and for the affection of their manager.',
    'Dois trompetistas competem por um emprego na banda de Artie Shaw e pelo afeto de sua empresária.',
    'दो तुरही वादक आर्टी शॉ के बैंड के साथ नौकरी के लिए और अपने प्रबंधक के स्नेह के लिए प्रतिस्पर्धा करते हैं।',
    'Два трубача соревнуются за работу в группе Арти Шоу и за привязанность своего менеджера.',
    'Due trombettisti competono per un lavoro con la band di Artie Shaw e per l''affetto del loro manager.',
    ARRAY['Musical', 'Comedy'], 1940, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Second_Chorus_poster.jpg/400px-Second_Chorus_poster.jpg', 
    NULL, 
    NULL, '6.0', '1h 24m', 'H.C. Potter', 'Movie', 'Public Domain', ARRAY['Fred Astaire'], ARRAY[]::text[]
),
(
    'us-s02', 'Secret Agent', 'O Agente Secreto', 'Secret Agent',
    'Three British intelligence agents are sent to Switzerland to assassinate a German spy.',
    'Três agentes da inteligência britânica são enviados à Suíça para assassinar um espião alemão.',
    'तीन ब्रिटिश खुफिया एजेंटों को एक जर्मन जासूस की हत्या करने के लिए स्विट्जरलैंड भेजा जाता है।',
    'Три агента британской разведки отправляются в Швейцарию, чтобы убить немецкого шпиона.',
    'Tre agenti dei servizi segreti britannici vengono inviati in Svizzera per assassinare una spia tedesca.',
    ARRAY['Thriller', 'Mystery'], 1936, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Secret_Agent_poster.jpg/400px-Secret_Agent_poster.jpg', 
    NULL, 
    NULL, '6.9', '1h 26m', 'Alfred Hitchcock', 'Movie', 'Public Domain', ARRAY['John Gielgud'], ARRAY[]::text[]
),
(
    'us-s03', 'Storm in a Teacup', 'Tempestade num Copo D''Água', 'Storm in a Teacup',
    'A reporter''s story about a politician''s cruelty to a dog creates a national fervor.',
    'A história de um repórter sobre a crueldade de um político com um cachorro cria um fervor nacional.',
    'एक कुत्ते के प्रति एक राजनेता की क्रूरता के बारे में एक रिपोर्टर की कहानी एक राष्ट्रीय उत्साह पैदा करती है।',
    'История репортера о жестокости политика по отношению к собаке вызывает национальный ажиотаж.',
    'La storia di un giornalista sulla crudeltà di un politico verso un cane crea un fervore nazionale.',
    ARRAY['Comedy', 'Romance'], 1937, 'English', true, 
    'https://placehold.co/400x600/333/FFF?text=Storm+Teacup', 
    NULL, 
    NULL, '6.8', '1h 27m', 'Victor Saville', 'Movie', 'Public Domain', ARRAY['Vivien Leigh'], ARRAY[]::text[]
),
(
    'us-s04', 'Swing High, Swing Low', 'Começou no Havaí', 'Swing High, Swing Low',
    'A shipboard romance between a cabaret singer and a soldier goes wrong when his career takes off.',
    'Um romance a bordo entre uma cantora de cabaré e um soldado dá errado quando a carreira dele decola.',
    'एक कैबरे गायक और एक सैनिक के बीच एक जहाज पर रोमांस गलत हो जाता है जब उसका करियर उड़ान भरता है।',
    'Роман на корабле между певицей кабаре и солдатом идет наперекосяк, когда его карьера идет в гору.',
    'Una storia d''amore a bordo di una nave tra una cantante di cabaret e un soldato va storta quando la sua carriera decolla.',
    ARRAY['Romance', 'Drama'], 1937, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Swing_High_Swing_Low_poster.jpg/400px-Swing_High_Swing_Low_poster.jpg', 
    NULL, 
    NULL, '6.1', '1h 32m', 'Mitchell Leisen', 'Movie', 'Public Domain', ARRAY['Carole Lombard'], ARRAY[]::text[]
),
(
    'us-t01', 'Three Came Home', 'Três Regressaram', 'Three Came Home',
    'Based on the true story of Agnes Newton Keith, held in a Japanese POW camp in Borneo during WWII.',
    'Baseado na história real de Agnes Newton Keith, mantida em um campo de prisioneiros japonês em Bornéu durante a Segunda Guerra Mundial.',
    'एग्नेस न्यूटन कीथ की सच्ची कहानी पर आधारित, द्वितीय विश्व युद्ध के दौरान बोर्नियो में एक जापानी POW शिविर में आयोजित किया गया।',
    'Основано на реальной истории Агнес Ньютон Кит, содержавшейся в японском лагере для военнопленных на Борнео во время Второй мировой войны.',
    'Basato sulla vera storia di Agnes Newton Keith, tenuta in un campo di prigionia giapponese nel Borneo durante la seconda guerra mondiale.',
    ARRAY['War', 'Drama'], 1950, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Three_Came_Home_%281950%29_poster.jpg/400px-Three_Came_Home_%281950%29_poster.jpg', 
    NULL, 
    NULL, '7.4', '1h 46m', 'Jean Negulesco', 'Movie', 'Public Domain', ARRAY['Claudette Colbert'], ARRAY[]::text[]
),
(
    'us-t02', 'Till the Clouds Roll By', 'Quando as Nuvens Passam', 'Till the Clouds Roll By',
    'A fictionalized biography of composer Jerome Kern, featuring performances by MGM stars.',
    'Uma biografia ficcional do compositor Jerome Kern, com apresentações de estrelas da MGM.',
    'संगीतकार जेरोम कर्न्स की एक काल्पनिक जीवनी, जिसमें एमजीएम सितारों का प्रदर्शन है।',
    'Вымышленная биография композитора Джерома Керна с участием звезд MGM.',
    'Una biografia romanzata del compositore Jerome Kern, con esibizioni di star della MGM.',
    ARRAY['Musical', 'Biography'], 1946, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Till_the_Clouds_Roll_By_%281946_poster%29.jpg/400px-Till_the_Clouds_Roll_By_%281946_poster%29.jpg', 
    'https://archive.org/download/till_the_clouds_roll_by_1946/till_the_clouds_roll_by_1946.mp4', 
    NULL, '6.4', '2h 12m', 'Richard Whorf', 'Movie', 'Archive.org', ARRAY['Judy Garland', 'Frank Sinatra'], ARRAY['Technicolor Spectacle']
),
(
    'us-t03', 'Too Late for Tears', 'A Tigresa', 'Too Late for Tears',
    'A housewife finds a bag of stolen money and will kill anyone who tries to take it from her.',
    'Uma dona de casa encontra uma bolsa com dinheiro roubado e matará qualquer um que tentar tirá-la dela.',
    'एक गृहिणी को चोरी के पैसों का एक थैला मिलता है और जो कोई भी इसे उससे लेने की कोशिश करेगा उसे वह मार डालेगी।',
    'Домохозяйка находит сумку с украденными деньгами и убьет любого, кто попытается отнять ее у нее.',
    'Una casalinga trova una borsa di denaro rubato e ucciderà chiunque cerchi di portargliela via.',
    ARRAY['Noir', 'Thriller'], 1949, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Too_Late_for_Tears_poster.jpg/400px-Too_Late_for_Tears_poster.jpg', 
    'https://archive.org/download/TooLateForTears/TooLateForTears.mp4', 
    NULL, '7.3', '1h 39m', 'Byron Haskin', 'Movie', 'Archive.org', ARRAY['Lizabeth Scott'], ARRAY[]::text[]
),
(
    'us-t04', 'Topper Returns', 'A Volta do Fantasma', 'Topper Returns',
    'A ghost asks Cosmo Topper to help find her killer.',
    'Um fantasma pede a Cosmo Topper para ajudar a encontrar seu assassino.',
    'एक भूत कॉस्मो टॉपर से अपने हत्यारे को खोजने में मदद करने के लिए कहता है।',
    'Призрак просит Космо Топпера помочь найти ее убийцу.',
    'Un fantasma chiede a Cosmo Topper di aiutarla a trovare il suo assassino.',
    ARRAY['Comedy', 'Mystery'], 1941, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Topper_Returns_%281941%29_poster.jpg/400px-Topper_Returns_%281941%29_poster.jpg', 
    'https://archive.org/download/topper_returns/topper_returns.mp4', 
    NULL, '6.9', '1h 28m', 'Roy Del Ruth', 'Movie', 'Archive.org', ARRAY['Joan Blondell'], ARRAY['Oscar Nominee']
),
(
    'us-w01', 'The Wasp Woman', 'A Mulher Vespa', 'The Wasp Woman',
    'A cosmetics queen develops a youth formula from jelly taken from queen wasps, but it has deadly side effects.',
    'Uma rainha dos cosméticos desenvolve uma fórmula da juventude a partir da geleia de vespas rainhas, mas tem efeitos colaterais mortais.',
    'एक सौंदर्य प्रसाधन रानी रानी ततैया से ली गई जेली से एक युवा फार्मूला विकसित करती है, लेकिन इसके घातक दुष्प्रभाव होते हैं।',
    'Королева косметики разрабатывает формулу молодости из желе, взятого у королевы ос, но у нее есть смертельные побочные эффекты.',
    'Una regina dei cosmetici sviluppa una formula della giovinezza dalla gelatina presa dalle vespe regine, ma ha effetti collaterali mortali.',
    ARRAY['Horror', 'Sci-Fi'], 1959, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/The_Wasp_Woman_poster.jpg/400px-The_Wasp_Woman_poster.jpg', 
    NULL, 
    NULL, '4.6', '1h 13m', 'Roger Corman', 'Movie', 'Public Domain', ARRAY['Susan Cabot'], ARRAY[]::text[]
)

ON CONFLICT (id) DO UPDATE SET 
    "title" = EXCLUDED."title",
    "titlePt" = EXCLUDED."titlePt",
    "description" = EXCLUDED."description",
    "descriptionPt" = EXCLUDED."descriptionPt",
    "descriptionHi" = EXCLUDED."descriptionHi",
    "descriptionRu" = EXCLUDED."descriptionRu",
    "descriptionIt" = EXCLUDED."descriptionIt",
    "genres" = EXCLUDED."genres",
    "year" = EXCLUDED."year",
    "videoUrl" = EXCLUDED."videoUrl",
    "posterUrl" = EXCLUDED."posterUrl",
    "cast_members" = EXCLUDED."cast_members",
    "director" = EXCLUDED."director",
    "sourceLabel" = EXCLUDED."sourceLabel",
    "awards" = EXCLUDED."awards";
