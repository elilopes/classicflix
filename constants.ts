
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
  { id: 'pessimo', label: { en: 'Péssimo (0-2)', pt: 'Péssimo (0-2)' }, min: 0, max: 2.9 },
  { id: 'ruim', label: { en: 'Ruim (3-5)', pt: 'Ruim (3-5)' }, min: 3, max: 5.9 },
  { id: 'moderado', label: { en: 'Moderado (6-7)', pt: 'Moderado (6-7)' }, min: 6, max: 7.9 },
  { id: 'bom', label: { en: 'Bom (8)', pt: 'Bom (8)' }, min: 8, max: 8.9 },
  { id: 'excelente', label: { en: 'Excelente (9-10)', pt: 'Excelente (9-10)' }, min: 9, max: 10 }
];

export const THEMES = [
  "Racism", "LGBTQIA+", "Justice", "Identity", "Economy", "Ethnoracial", "Religious", "Rebellion", 
  "Social Inequality", "Feminism", "War & Peace", "Corruption", "Mental Health", "Environment", 
  "Colonialism", "Family Dynamics", "Urban Life", "Surrealism"
];

export const DURATIONS = [
  { id: 'very_short', label: { en: 'Very Short (<= 5m)', pt: 'Curtíssimo (<= 5m)', it: 'Molto corto', hi: 'बहुत छोटा', ru: 'Очень короткий' } },
  { id: 'short', label: { en: 'Short (<= 20m)', pt: 'Curto (<= 20m)', it: 'Corto', hi: 'छोटा', ru: 'Короткий' } },
  { id: 'medium', label: { en: 'Medium (<= 40m)', pt: 'Médio (<= 40m)', it: 'Medio', hi: 'मध्यम', ru: 'Средний' } },
  { id: 'long', label: { en: 'Long (<= 2h)', pt: 'Longo (<= 2h)', it: 'Lungo', hi: 'लंबा', ru: 'Длинный' } },
  { id: 'giant', label: { en: 'Giant (> 2h)', pt: 'Gigante (> 2h)', it: 'Gigante', hi: 'विशाल', ru: 'Гигантский' } }
];

export const INITIAL_MOVIES: Movie[] = movies;

export const APP_TRANSLATIONS: Record<AppLanguage, any> = {
  en: {
    searchPlaceholder: "Search movies, plots or directors...",
    login: "Login",
    signup: "Sign Up",
    logout: "Logout",
    addMovie: "Add Movie",
    updateSupabase: "Update Database",
    updateApp: "Update App",
    totalMovies: "Total Movies",
    mostWatched: "Most Watched",
    myLists: "My Lists",
    welcomeTitle: "Welcome to ClassicFlix",
    welcomeText: "Your premium gateway to the history of cinema. All titles are copyright-free.",
    footerText: "Classicflix by TechViva - Elias Lopes. Cataloging public domain history.",
    any: "Any",
    duration: "Duration",
    color: "Color",
    theme: "Theme",
    year: "Year",
    decade: "Decade",
    rating: "Rating",
    language: "Language",
    subtitles: "Subtitles",
    viewMode: "View Mode",
    imageMode: "Image",
    textMode: "Text",
    director: "Director",
    awards: "Awards",
    cancel: "Cancel",
    username: "Username",
    password: "Password"
  },
  pt: {
    searchPlaceholder: "Pesquisar filmes, tramas ou diretores...",
    login: "Entrar",
    signup: "Cadastrar",
    logout: "Sair",
    addMovie: "Adicionar Filme",
    updateSupabase: "Atualizar Supabase",
    updateApp: "Atualizar Aplicação",
    totalMovies: "Total de Filmes",
    mostWatched: "Mais Assistidos",
    myLists: "Minhas Listas",
    welcomeTitle: "Bem-vindo ao ClassicFlix",
    welcomeText: "Seu portal premium para a história do cinema. Todos os títulos são livres de direitos.",
    footerText: "Classicflix by TechViva - Elias Lopes. Catalogando a história do cinema em domínio público.",
    any: "Qualquer",
    duration: "Duração",
    color: "Cor",
    theme: "Tema",
    year: "Ano",
    decade: "Década",
    rating: "Classificação",
    language: "Idioma",
    subtitles: "Legendas",
    viewMode: "Exibição",
    imageMode: "Imagem",
    textMode: "Texto",
    director: "Diretor",
    awards: "Prêmios",
    cancel: "Cancelar",
    username: "Usuário",
    password: "Senha"
  },
  it: {
    searchPlaceholder: "Cerca film...",
    login: "Accedi",
    signup: "Iscriviti",
    logout: "Esci",
    addMovie: "Aggiungi film",
    updateSupabase: "Aggiorna database",
    updateApp: "Aggiorna App",
    totalMovies: "Film totali",
    mostWatched: "Più visti",
    welcomeTitle: "Benvenuti su ClassicFlix",
    welcomeText: "Il tuo portale premium per la storia del cinema.",
    footerText: "Classicflix by TechViva - Elias Lopes. Cataloging public domain history.",
    any: "Qualsiasi",
    duration: "Durata",
    color: "Colore",
    theme: "Tema",
    year: "Anno",
    decade: "Decennio",
    rating: "Valutazione",
    language: "Lingua",
    subtitles: "Sottotitoli",
    viewMode: "Visualizzazione",
    imageMode: "Immagine",
    textMode: "Testo",
    director: "Regista",
    awards: "Premi",
    cancel: "Annulla"
  },
  hi: {
    searchPlaceholder: "फिल्में खोजें...",
    login: "लॉगिन",
    signup: "साइन अप",
    logout: "लॉग आउट",
    addMovie: "फिल्म जोड़ें",
    updateSupabase: "डेटाबेस अपडेट करें",
    updateApp: "ऐप अपडेट करें",
    totalMovies: "कुल फिल्में",
    mostWatched: "सर्वाधिक देखे गए",
    welcomeTitle: "ClassicFlix में आपका स्वागत है",
    welcomeText: "सिनेमा के इतिहास के लिए आपका प्रीमियम पोर्टल।",
    footerText: "Classicflix by TechViva - Elias Lopes. Cataloging public domain history.",
    any: "कोई भी",
    duration: "अवधि",
    color: "रंग",
    theme: "विषय",
    year: "वर्ष",
    decade: "दशक",
    rating: "रेटिंग",
    language: "भाषा",
    subtitles: "उपशीर्षक",
    viewMode: "देखने का तरीका",
    imageMode: "छवि",
    textMode: "पाठ",
    director: "निर्देशक",
    awards: "पुरस्कार",
    cancel: "रद्द करें"
  },
  ru: {
    searchPlaceholder: "Поиск фильмов...",
    login: "Войти",
    signup: "Регистрация",
    logout: "Выйти",
    addMovie: "Добавить фильм",
    updateSupabase: "Обновить базу",
    updateApp: "Обновить приложение",
    totalMovies: "Всего фильмов",
    mostWatched: "Самые популярные",
    welcomeTitle: "Добро пожаловать в ClassicFlix",
    welcomeText: "Ваш премиальный портал в историю кино.",
    footerText: "Classicflix by TechViva - Elias Lopes. Cataloging public domain history.",
    any: "Любой",
    duration: "Длительность",
    color: "Цвет",
    theme: "Тема",
    year: "Год",
    decade: "Десятилетие",
    rating: "Рейтинг",
    language: "Язык",
    subtitles: "Субтитры",
    viewMode: "Вид",
    imageMode: "Картинка",
    textMode: "Текст",
    director: "Режиссер",
    awards: "Награды",
    cancel: "Отмена"
  }
};
