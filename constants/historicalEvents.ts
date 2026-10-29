
export interface HistoricalEvent {
  year: number;
  titleEn: string;
  titlePt: string;
  descriptionEn: string;
  descriptionPt: string;
  category: 'war' | 'science' | 'politics' | 'culture' | 'disaster';
}

export const HISTORICAL_EVENTS: HistoricalEvent[] = [
  {
    year: 1895,
    titleEn: "First Public Movie Screening",
    titlePt: "Primeira Exibição Pública de Cinema",
    descriptionEn: "The Lumière brothers hold the first public screening of films in Paris.",
    descriptionPt: "Os irmãos Lumière realizam a primeira exibição pública de filmes em Paris.",
    category: 'culture'
  },
  {
    year: 1912,
    titleEn: "Sinking of the Titanic",
    titlePt: "Naufrágio do Titanic",
    descriptionEn: "The RMS Titanic sinks in the North Atlantic after hitting an iceberg.",
    descriptionPt: "O RMS Titanic afunda no Atlântico Norte após colidir com um iceberg.",
    category: 'disaster'
  },
  {
    year: 1914,
    titleEn: "World War I Begins",
    titlePt: "Início da Primeira Guerra Mundial",
    descriptionEn: "The assassination of Archduke Franz Ferdinand triggers the Great War.",
    descriptionPt: "O assassinato do arquiduque Franz Ferdinand desencadeia a Grande Guerra.",
    category: 'war'
  },
  {
    year: 1918,
    titleEn: "End of World War I",
    titlePt: "Fim da Primeira Guerra Mundial",
    descriptionEn: "The armistice is signed, ending the fighting in WWI.",
    descriptionPt: "O armistício é assinado, encerrando os combates na Primeira Guerra Mundial.",
    category: 'war'
  },
  {
    year: 1927,
    titleEn: "The Jazz Singer - First Talkie",
    titlePt: "O Cantor de Jazz - Primeiro Filme Falado",
    descriptionEn: "The release of 'The Jazz Singer' marks the end of the silent film era.",
    descriptionPt: "O lançamento de 'O Cantor de Jazz' marca o fim da era do cinema mudo.",
    category: 'culture'
  },
  {
    year: 1929,
    titleEn: "The Great Depression Begins",
    titlePt: "Início da Grande Depressão",
    descriptionEn: "The Wall Street Crash of 1929 leads to a worldwide economic downturn.",
    descriptionPt: "A quebra da Bolsa de Nova York em 1929 leva a uma crise econômica mundial.",
    category: 'politics'
  },
  {
    year: 1939,
    titleEn: "World War II Begins",
    titlePt: "Início da Segunda Guerra Mundial",
    descriptionEn: "Germany invades Poland, triggering the start of WWII.",
    descriptionPt: "A Alemanha invade a Polônia, desencadeando o início da Segunda Guerra Mundial.",
    category: 'war'
  },
  {
    year: 1941,
    titleEn: "Attack on Pearl Harbor",
    titlePt: "Ataque a Pearl Harbor",
    descriptionEn: "Japan attacks the US naval base at Pearl Harbor, bringing the US into WWII.",
    descriptionPt: "O Japão ataca a base naval dos EUA em Pearl Harbor, trazendo os EUA para a Segunda Guerra Mundial.",
    category: 'war'
  },
  {
    year: 1945,
    titleEn: "End of World War II",
    titlePt: "Fim da Segunda Guerra Mundial",
    descriptionEn: "The surrender of Germany and Japan ends WWII.",
    descriptionPt: "A rendição da Alemanha e do Japão encerra a Segunda Guerra Mundial.",
    category: 'war'
  },
  {
    year: 1953,
    titleEn: "Discovery of DNA Structure",
    titlePt: "Descoberta da Estrutura do DNA",
    descriptionEn: "Watson and Crick describe the double helix structure of DNA.",
    descriptionPt: "Watson e Crick descrevem a estrutura de dupla hélice do DNA.",
    category: 'science'
  },
  {
    year: 1957,
    titleEn: "Launch of Sputnik 1",
    titlePt: "Lançamento do Sputnik 1",
    descriptionEn: "The Soviet Union launches the first artificial satellite into orbit.",
    descriptionPt: "A União Soviética lança o primeiro satélite artificial em órbita.",
    category: 'science'
  },
  {
    year: 1961,
    titleEn: "First Human in Space",
    titlePt: "Primeiro Humano no Espaço",
    descriptionEn: "Yuri Gagarin becomes the first human to journey into outer space.",
    descriptionPt: "Yuri Gagarin torna-se o primeiro humano a viajar para o espaço sideral.",
    category: 'science'
  },
  {
    year: 1963,
    titleEn: "Assassination of JFK",
    titlePt: "Assassinato de JFK",
    descriptionEn: "President John F. Kennedy is assassinated in Dallas, Texas.",
    descriptionPt: "O presidente John F. Kennedy é assassinado em Dallas, Texas.",
    category: 'politics'
  },
  {
    year: 1969,
    titleEn: "Moon Landing",
    titlePt: "Pouso na Lua",
    descriptionEn: "Apollo 11 lands on the moon, and Neil Armstrong takes the first steps.",
    descriptionPt: "A Apollo 11 pousa na Lua e Neil Armstrong dá os primeiros passos.",
    category: 'science'
  }
];
