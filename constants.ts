
import { Movie, AppLanguage } from './types';
import { movies } from './movies';

export const GENRES = [
  "Documentary", "Horror", "Sci-Fi", "Comedy", "Drama", "Thriller", "Action", "Romance", "Mystery", "Western", "War", "Experimental", "Adventure", "Fantasy", "Animation", "History", "Noir", "Musical", "Short"
];

export const LANGUAGES = [
  "English", "Portuguese", "Spanish", "French", "German", "Silent", "Italian", "Japanese", "Russian", "Czech", "Hebrew", "Chinese", "Korean"
];

export const COLORS = [
  "Black & White", "Color", "Mixed"
];

export const DECADES = [1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970];

export const RATING_CATEGORIES = [
  { id: 'pessimo', label: { en: 'Awful (0-2)', pt: 'Péssimo (0-2)' }, min: 0, max: 2.9 },
  { id: 'ruim', label: { en: 'Bad (3-5)', pt: 'Ruim (3-5)' }, min: 3, max: 5.9 },
  { id: 'moderado', label: { en: 'Moderate (6-7)', pt: 'Moderado (6-7)' }, min: 6, max: 7.9 },
  { id: 'bom', label: { en: 'Good (8)', pt: 'Bom (8)' }, min: 8, max: 8.9 },
  { id: 'excelente', label: { en: 'Excellent (9-10)', pt: 'Excelente (9-10)' }, min: 9, max: 10 }
];

export const THEMES = [
  "Racism", "LGBTQIA+", "Justice", "Identity", "Economy", "Ethnoracial", "Religious", "Rebellion", 
  "Social Inequality", "Feminism", "War & Peace", "Corruption", "Mental Health", "Environment", 
  "Colonialism", "Family Dynamics", "Urban Life", "Surrealism"
];

export const DURATIONS = [
  { id: 'very_short', label: { en: 'Very Short (<= 5m)', pt: 'Curtíssimo (<= 5m)' } },
  { id: 'short', label: { en: 'Short (<= 20m)', pt: 'Curto (<= 20m)' } },
  { id: 'medium', label: { en: 'Medium (<= 40m)', pt: 'Médio (<= 40m)' } },
  { id: 'long', label: { en: 'Long (<= 2h)', pt: 'Longo (<= 2h)' } },
  { id: 'giant', label: { en: 'Giant (> 2h)', pt: 'Gigante (> 2h)' } }
];

export const INITIAL_MOVIES: Movie[] = movies;

export const MOST_WATCHED_MOVIES = [
  "1. A Noite dos Mortos-Vivos", "2. Charada", "3. Nosferatu", "4. Metrópolis", "5. Steamboat Willie",
  "6. Em Busca do Ouro", "7. O Encouraçado Potemkin", "8. Viagem à Lua", "9. O General", "10. Nada de Novo no Front",
  "11. Jejum de Amor (His Girl Friday)", "12. O Gabinete do Dr. Caligari", "13. A Paixão de Joana d’Arc", "14. O Fantasma da Ópera", "15. Plan 9 from Outer Space",
  "16. O Garoto (The Kid)", "17. A Pequena Loja de Horrores", "18. Um Homem com uma Câmera", "19. Häxan", "20. O Anjo Azul",
  "21. A Casa dos Maus Espíritos", "22. Carnival of Souls", "23. As Viagens de Gulliver", "24. O Estranho (The Stranger)", "25. Reefer Madness",
  "26. Sherlock Jr.", "27. Um Cão Andaluz", "28. Abraham Lincoln", "29. Santa Fe Trail", "30. Raja Harishchandra"
];

export const APP_TRANSLATIONS: Record<AppLanguage, any> = {
  en: {
    searchPlaceholder: "Search movies, plots or directors...",
    login: "Login", signup: "Sign Up", logout: "Logout",
    addMovie: "Add Movie", totalMovies: "Total Movies",
    welcomeTitle: "Welcome to ClassicFlix",
    welcomeText: "Explore the golden age of cinema in public domain. To start, use the search bar or pick a filter to discover classics.",
    director: "Director", year: "Year", language: "Language",
    rating: "Rating", footerText: "Classicflix by TechViva - Elias Lopes. Cataloging the history of public domain cinema.",
    moreInfo: "More Info", back: "Back", top30Label: "Top 30 Hits", onlyWithPoster: "Poster Only",
    decade: "Decade", awards: "Awards", loadMore: "Load More", noTitlesFound: "No titles found."
  },
  pt: {
    searchPlaceholder: "Pesquisar filmes, tramas ou diretores...",
    login: "Entrar", signup: "Cadastrar", logout: "Sair",
    addMovie: "Adicionar Filme", totalMovies: "Total de Filmes",
    welcomeTitle: "Bem-vindo ao ClassicFlix",
    welcomeText: "Explore a era de ouro do cinema em domínio público. Para começar, use a barra de busca acima ou escolha um filtro.",
    director: "Diretor", year: "Ano", language: "Idioma",
    rating: "Classificação", footerText: "Classicflix by TechViva - Elias Lopes. Catalogando a história do cinema em domínio público.",
    moreInfo: "Mais Info", back: "Voltar", top30Label: "Top 30 Mais Vistos", onlyWithPoster: "Somente com Poster",
    decade: "Década", awards: "Prêmios", loadMore: "Carregar Mais", noTitlesFound: "Nenhum título encontrado."
  },
  it: {
    searchPlaceholder: "Cerca film, trame o registi...",
    login: "Accedi", signup: "Iscriviti", logout: "Esci",
    addMovie: "Aggiungi Film", totalMovies: "Film Totali",
    welcomeTitle: "Benvenuti in ClassicFlix",
    welcomeText: "Esplora l'età dell'oro del cinema di pubblico dominio. Per iniziare, usa la barra di ricerca o scegli un filtro.",
    director: "Regista", year: "Anno", language: "Lingua",
    rating: "Valutazione", footerText: "Classicflix di TechViva - Elias Lopes. Catalogazione della storia del cinema di pubblico dominio.",
    moreInfo: "Più Info", back: "Indietro", top30Label: "Top 30 Successi", onlyWithPoster: "Solo Poster",
    decade: "Decennio", awards: "Premi", loadMore: "Carica Altri", noTitlesFound: "Nessun titolo trovato."
  },
  hi: {
    searchPlaceholder: "फिल्में, कथानक या निर्देशक खोजें...",
    login: "लॉगिन", signup: "साइन अप", logout: "लॉगआउट",
    addMovie: "फिल्म जोड़ें", totalMovies: "कुल फिल्में",
    welcomeTitle: "ClassicFlix में आपका स्वागत है",
    welcomeText: "सार्वजनिक डोमेन में सिनेमा के स्वर्ण युग का अन्वेषण करें। शुरू करने के लिए, खोज बार का उपयोग करें या फ़िल्टर चुनें।",
    director: "निर्देशक", year: "वर्ष", language: "भाषा",
    rating: "रेटिंग", footerText: "Classicflix by TechViva - Elias Lopes. सार्वजनिक डोमेन सिनेमा के इतिहास को सूचीबद्ध करना।",
    moreInfo: "अधिक जानकारी", back: "वापस", top30Label: "शीर्ष 30 हिट्स", onlyWithPoster: "केवल पोस्टर",
    decade: "दशक", awards: "पुरस्कार", loadMore: "और लोड करें", noTitlesFound: "कोई शीर्षक नहीं मिला।"
  },
  ru: {
    searchPlaceholder: "Поиск фильмов, сюжетов или режиссеров...",
    login: "Войти", signup: "Регистрация", logout: "Выйти",
    addMovie: "Добавить фильм", totalMovies: "Всего фильмов",
    welcomeTitle: "Добро пожаловать в ClassicFlix",
    welcomeText: "Исследуйте золотой век кинематографа в общественном достоянии. Для начала воспользуйтесь поиском или фильтром.",
    director: "Режиссер", year: "Год", language: "Язык",
    rating: "Рейтинг", footerText: "Classicflix от TechViva - Elias Lopes. Каталогизация истории кино в общественном достоянии.",
    moreInfo: "Подробнее", back: "Назад", top30Label: "Топ 30 хитов", onlyWithPoster: "Только постеры",
    decade: "Десятилетие", awards: "Награды", loadMore: "Загрузить еще", noTitlesFound: "Ничего не найдено."
  }
};
