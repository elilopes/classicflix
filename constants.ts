
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
    addMovie: "Add Movie", updateSupabase: "Update Database",
    totalMovies: "Total Movies", mostWatched: "Most Watched",
    onlyWithPoster: "Poster Only", top30Label: "Top 30 Hits",
    director: "Director", year: "Year", language: "Language",
    rating: "Rating", viewMode: "View", imageMode: "Grid", textMode: "List",
    footerText: "Classicflix by TechViva - Elias Lopes.",
    moreInfo: "More Info", back: "Back", details: "Technical Details"
  },
  pt: {
    searchPlaceholder: "Pesquisar filmes, tramas ou diretores...",
    login: "Entrar", signup: "Cadastrar", logout: "Sair",
    addMovie: "Adicionar Filme", updateSupabase: "Atualizar Supabase",
    totalMovies: "Total de Filmes", mostWatched: "Mais Assistidos",
    onlyWithPoster: "Somente com Poster", top30Label: "Top 30 Mais Vistos",
    director: "Diretor", year: "Ano", language: "Idioma",
    rating: "Classificação", viewMode: "Exibição", imageMode: "Imagem", textMode: "Texto",
    footerText: "Classicflix by TechViva - Elias Lopes. Catalogando a história do cinema.",
    moreInfo: "Mais Info", back: "Voltar", details: "Detalhes Técnicos"
  },
  it: { /* omitted for brevity, keeping types happy */ },
  hi: { /* omitted for brevity, keeping types happy */ },
  ru: { /* omitted for brevity, keeping types happy */ }
};
