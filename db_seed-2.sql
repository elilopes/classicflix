-- ============================================================
-- PART 2: US PUBLIC DOMAIN MOVIES (A-L)
-- ============================================================

INSERT INTO public.movies (
    "id", "title", "titlePt", "originalTitle", 
    "description", "descriptionPt", "descriptionHi", "descriptionRu", "descriptionIt",
    "genres", "year", "language", "hasSubtitles", 
    "posterUrl", "videoUrl", "trailerUrl", "rating", "duration", 
    "director", "type", "sourceLabel", "cast_members", "awards"
) VALUES 

-- CORE CLASSICS (Existing ones to ensure presence)
(
    '1', 'Night of the Living Dead', 'A Noite dos Mortos-Vivos', 'Night of the Living Dead',
    'A group of people hide in a farmhouse from bloodthirsty zombies. A classic that defined the modern zombie movie.',
    'Um grupo de pessoas se esconde em uma fazenda de zumbis sedentos por sangue. Um clássico que definiu o filme de zumbi moderno.',
    'लोगों का एक समूह रक्तपिपासु लाशों से बचने के लिए एक फार्महाउस में छिपा है। एक क्लासिक जिसने आधुनिक ज़ोंबी फिल्म को परिभाषित किया।',
    'Группа людей прячется в фермерском доме от кровожадных зомби. Классика, определившая современный фильм о зомби.',
    'Un gruppo di persone si nasconde in una fattoria da zombi assetati di sangue. Un classico che ha definito il moderno film di zombi.',
    ARRAY['Horror', 'Thriller'], 1968, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Night_of_the_Living_Dead_movie_poster.jpg/400px-Night_of_the_Living_Dead_movie_poster.jpg', 
    'https://archive.org/download/night_of_the_living_dead/night_of_the_living_dead_512kb.mp4', 
    NULL, '8.5', '1h 36m', 'George A. Romero', 'Movie', 'Archive.org', ARRAY['Duane Jones', 'Judith O''Dea'], ARRAY['National Film Registry']
),
(
    '58', 'Charade', 'Charada', 'Charade',
    'Romance and suspense ensue in Paris as a woman is pursued by several men who want a fortune.',
    'Romance e suspense em Paris enquanto uma mulher é perseguida por vários homens que querem uma fortuna.',
    'पेरिस में रोमांस और रहस्य का माहौल है क्योंकि एक महिला का कई पुरुषों द्वारा पीछा किया जाता है जो एक भाग्य चाहते हैं।',
    'Романтика и саспенс в Париже: женщину преследуют несколько мужчин, желающих получить состояние.',
    'Romanticismo e suspense a Parigi mentre una donna è inseguita da diversi uomini che vogliono una fortuna.',
    ARRAY['Mystery', 'Romance', 'Thriller'], 1963, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Charade_poster.jpg/400px-Charade_poster.jpg', 
    'https://archive.org/download/Charade1963/Charade.mp4', 
    NULL, '7.9', '1h 53m', 'Stanley Donen', 'Movie', 'Public Domain', ARRAY['Cary Grant', 'Audrey Hepburn'], ARRAY['BAFTA Winner']
),

-- NEW ADDITIONS A-L
(
    'us-a01', 'Angel and the Badman', 'O Anjo e o Malfeitor', 'Angel and the Badman',
    'A wounded gunman is nursed back to health by a Quaker girl and must choose between her world and his.',
    'Um pistoleiro ferido é tratado por uma garota Quaker e deve escolher entre o mundo dela e o dele.',
    'एक घायल बंदूकधारी को एक क्विकर लड़की द्वारा स्वस्थ किया जाता है और उसे उसकी दुनिया और उसकी दुनिया के बीच चयन करना होगा।',
    'Раненый стрелок выхаживается девушкой-квакером и должен выбирать между ее миром и своим.',
    'Un pistolero ferito viene curato da una ragazza quacchera e deve scegliere tra il suo mondo e il suo.',
    ARRAY['Western', 'Romance'], 1947, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Angel_and_the_badman_poster.jpg/400px-Angel_and_the_badman_poster.jpg', 
    'https://archive.org/download/AngelAndTheBadman1947/AngelAndTheBadman1947.mp4', 
    NULL, '6.9', '1h 40m', 'James Edward Grant', 'Movie', 'Archive.org', ARRAY['John Wayne', 'Gail Russell'], ARRAY[]::text[]
),
(
    'us-a02', 'Algiers', 'Argel', 'Algiers',
    'A notorious French jewel thief hiding in the Casbah of Algiers is lured out by a beautiful tourist.',
    'Um notório ladrão de joias francês escondido no Casbah de Argel é atraído por uma bela turista.',
    'अल्जीयर्स के कसबाह में छिपा एक कुख्यात फ्रांसीसी गहना चोर एक खूबसूरत पर्यटक द्वारा बाहर निकाला जाता है।',
    'Известный французский похититель драгоценностей, скрывающийся в Касбе Алжира, выманим наружу красивой туристкой.',
    'Un famigerato ladro di gioielli francese nascosto nella Casbah di Algeri viene attirato fuori da una bella turista.',
    ARRAY['Drama', 'Romance'], 1938, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Algiers_poster.jpg/400px-Algiers_poster.jpg', 
    'https://archive.org/download/algiers_1938/algiers_1938.mp4', 
    NULL, '7.5', '1h 36m', 'John Cromwell', 'Movie', 'Archive.org', ARRAY['Charles Boyer', 'Hedy Lamarr'], ARRAY['Oscar Nominee']
),
(
    'us-b01', 'Beneath the 12-Mile Reef', 'Os Recifes de Coral', 'Beneath the 12-Mile Reef',
    'Fishermen compete for sponge-gathering territory off the coast of Florida.',
    'Pescadores competem por território de coleta de esponjas na costa da Flórida.',
    'मछुआरे फ्लोरिडा के तट से स्पंज इकट्ठा करने वाले क्षेत्र के लिए प्रतिस्पर्धा करते हैं।',
    'Рыбаки соревнуются за территорию сбора губок у побережья Флориды.',
    'I pescatori competono per il territorio di raccolta delle spugne al largo della costa della Florida.',
    ARRAY['Adventure', 'Romance'], 1953, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Beneath_the_12-Mile_Reef_poster.jpg/400px-Beneath_the_12-Mile_Reef_poster.jpg', 
    NULL, 
    NULL, '6.2', '1h 42m', 'Robert D. Webb', 'Movie', 'Public Domain', ARRAY['Robert Wagner'], ARRAY[]::text[]
),
(
    'us-b02', 'Bluebeard', 'O Barba Azul', 'Bluebeard',
    'A puppeteer in 19th-century Paris murders women to use their hair for his marionettes.',
    'Um marionetista na Paris do século 19 mata mulheres para usar seus cabelos em suas marionetes.',
    '19वीं सदी के पेरिस में एक कठपुतली वाला अपनी कठपुतलियों के लिए उनके बालों का उपयोग करने के लिए महिलाओं की हत्या करता है।',
    'Кукловод в Париже 19-го века убивает женщин, чтобы использовать их волосы для своих марионеток.',
    'Un burattinaio nella Parigi del XIX secolo uccide le donne per usare i loro capelli per le sue marionette.',
    ARRAY['Horror', 'Thriller'], 1944, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Bluebeard_%281944%29_poster.jpg/400px-Bluebeard_%281944%29_poster.jpg', 
    NULL, 
    NULL, '5.8', '1h 12m', 'Edgar G. Ulmer', 'Movie', 'Public Domain', ARRAY['John Carradine'], ARRAY[]::text[]
),
(
    'us-b03', 'The Brain That Wouldn''t Die', 'O Cérebro que não Queria Morrer', 'The Brain That Wouldn''t Die',
    'A doctor revives his fiancée''s severed head and searches for a new body for her.',
    'Um médico revive a cabeça decepada de sua noiva e procura um novo corpo para ela.',
    'एक डॉक्टर अपनी मंगेतर के कटे हुए सिर को पुनर्जीवित करता है और उसके लिए एक नए शरीर की तलाश करता है।',
    'Врач оживляет отрубленную голову своей невесты и ищет для нее новое тело.',
    'Un medico rianima la testa mozzata della sua fidanzata e cerca un nuovo corpo per lei.',
    ARRAY['Sci-Fi', 'Horror'], 1962, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Brain_That_Wouldnt_Die_Poster.jpg/400px-Brain_That_Wouldnt_Die_Poster.jpg', 
    'https://archive.org/download/TheBrainThatWouldntDie1962/TheBrainThatWouldntDie.mp4', 
    NULL, '4.2', '1h 22m', 'Joseph Green', 'Movie', 'Archive.org', ARRAY['Jason Evers'], ARRAY['Cult Classic']
),
(
    'us-c01', 'Check and Double Check', 'Os Detetives', 'Check and Double Check',
    'Radio stars Amos ''n'' Andy try to find a missing paper to help a couple in love.',
    'As estrelas do rádio Amos ''n'' Andy tentam encontrar um papel perdido para ajudar um casal apaixonado.',
    'रेडियो सितारे अमोस ''एन'' एंडी प्यार में एक जोड़े की मदद करने के लिए एक लापता कागज खोजने की कोशिश करते हैं।',
    'Звезды радио Амос и Энди пытаются найти пропавшую бумагу, чтобы помочь влюбленной паре.',
    'Le star della radio Amos ''n'' Andy cercano di trovare un documento mancante per aiutare una coppia di innamorati.',
    ARRAY['Comedy'], 1930, 'English', false, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Check_and_Double_Check_%281930%29_poster.jpg/400px-Check_and_Double_Check_%281930%29_poster.jpg', 
    NULL, 
    NULL, '4.5', '1h 17m', 'Melville W. Brown', 'Movie', 'Public Domain', ARRAY['Freeman Gosden'], ARRAY[]::text[]
),
(
    'us-c02', 'The Chase', 'A Senda do Temor', 'The Chase',
    'A chauffeur falls in love with his gangster boss''s wife and they attempt to flee to Havana.',
    'Um motorista se apaixona pela esposa de seu chefe gângster e eles tentam fugir para Havana.',
    'एक ड्राइवर अपने गैंगस्टर बॉस की पत्नी के प्यार में पड़ जाता है और वे हवाना भागने का प्रयास करते हैं।',
    'Шофер влюбляется в жену своего босса-гангстера, и они пытаются сбежать в Гавану.',
    'Un autista si innamora della moglie del suo capo gangster e tentano di fuggire all''Avana.',
    ARRAY['Noir', 'Thriller'], 1946, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/The_Chase_%281946%29_poster.jpg/400px-The_Chase_%281946%29_poster.jpg', 
    NULL, 
    NULL, '6.6', '1h 26m', 'Arthur Ripley', 'Movie', 'Public Domain', ARRAY['Robert Cummings'], ARRAY[]::text[]
),
(
    'us-g01', 'Glen or Glenda', 'Glen ou Glenda', 'Glen or Glenda',
    'A semi-autobiographical docudrama about Ed Wood''s own transvestism.',
    'Um docudrama semi-autobiográfico sobre o travestismo do próprio Ed Wood.',
    'एड वुड के अपने ट्रांसवेस्टिज्म के बारे में एक अर्ध-आत्मकथात्मक डॉक्यूड्रामा।',
    'Полуавтобиографическая документальная драма о трансвестизме самого Эда Вуда.',
    'Un docudramma semi-autobiografico sul travestitismo di Ed Wood.',
    ARRAY['Drama', 'Cult'], 1953, 'English', false, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Glen_or_Glenda_poster.jpg/400px-Glen_or_Glenda_poster.jpg', 
    'https://archive.org/download/glen_or_glenda/glen_or_glenda.mp4', 
    NULL, '4.1', '1h 5m', 'Ed Wood', 'Movie', 'Archive.org', ARRAY['Bela Lugosi'], ARRAY['Cult Classic']
),
(
    'us-g02', 'Go for Broke!', 'O Melhor é Arriscar', 'Go for Broke!',
    'A tribute to the Japanese-American 442nd Regimental Combat Team during WWII.',
    'Uma homenagem ao 442º Regimento de Combate Nipo-Americano durante a Segunda Guerra Mundial.',
    'द्वितीय विश्व युद्ध के दौरान जापानी-अमेरिकी 442वें रेजिमेंटल कॉम्बैट टीम को श्रद्धांजलि।',
    'Дань уважения японско-американской 442-й полковой боевой группе во время Второй мировой войны.',
    'Un omaggio al 442° Reggimento di Combattimento Giapponese-Americano durante la seconda guerra mondiale.',
    ARRAY['War', 'Drama'], 1951, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Go_for_Broke_1951.jpg/400px-Go_for_Broke_1951.jpg', 
    NULL, 
    NULL, '7.0', '1h 32m', 'Robert Pirosh', 'Movie', 'Public Domain', ARRAY['Van Johnson'], ARRAY[]::text[]
),
(
    'us-i01', 'The Indestructible Man', 'O Monstro de Vingador', 'The Indestructible Man',
    'An executed criminal is brought back to life and seeks revenge on those who betrayed him.',
    'Um criminoso executado é trazido de volta à vida e busca vingança contra aqueles que o traíram.',
    'एक फांसी दिए गए अपराधी को वापस जीवन में लाया जाता है और उन लोगों से बदला लेता है जिन्होंने उसे धोखा दिया था।',
    'Казненный преступник возвращается к жизни и ищет мести тем, кто его предал.',
    'Un criminale giustiziato viene riportato in vita e cerca vendetta su coloro che lo hanno tradito.',
    ARRAY['Sci-Fi', 'Horror'], 1956, 'English', true, 
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Indestructible_Man_poster.jpg/400px-Indestructible_Man_poster.jpg', 
    NULL, 
    NULL, '4.6', '1h 10m', 'Jack Pollexfen', 'Movie', 'Public Domain', ARRAY['Lon Chaney Jr.'], ARRAY[]::text[]
),
(
    'us-i02', 'The Iron Mask', 'O Máscara de Ferro', 'The Iron Mask',
    'Douglas Fairbanks stars as d''Artagnan in this sequel to The