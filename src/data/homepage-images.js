// Homepage Image Configuration
// Edit this file to control which images appear on the homepage and their sizes.
//
// Size Options:
// - `portrait` - Standard portrait size (1 column × 1 row)
// - `landscape` - Landscape/horizontal (2 columns × 1 row) 
// - `xlportrait` - Extra-large portrait (2 columns × 2 rows) - featured images
//
// Order Control:
// - Set `order: 1, 2, 3...` to force specific positions
// - Images without `order` will be auto-arranged by the optimizer
//
// Caption:
// - Provide a custom caption for each image
// - If not provided, the filename will be used (with dashes/underscores converted to spaces)
//
// Cloudinary:
// - Optionally provide `cloudinaryPublicId` when the Cloudinary asset name differs from the local filename

export const images = [
  {
    order: 1,
    filename: 'john-hopfield_nobel-physics_2024.jpg',
    size: 'portrait', // 2048x2560 (0.8 ratio - portrait)
    caption: 'Nobel Prize in Physics Ceremony'
  },
  {
    order: 2,
    filename: 'judd-apatow_sxsw_2024.jpg',
    size: 'portrait', // 1519x2560 (0.59 ratio - portrait)
    caption: 'Judd Apatow at SXSW'
  },
  {
    order: 3,
    filename: 'vanessa-kirby_tiff_2024.jpg',
    size: 'xlportrait', // 1978x2560 (0.77 ratio - portrait, featured)
    caption: 'Vanessa Kirby at TIFF 2024'
  },
  {
    filename: 'jeremy-strong_the-apprentice-premiere_2024.jpg',
    size: 'portrait', // 2048x2560 (0.8 ratio - portrait)
    caption: 'Jeremy Strong at the New York red carpet premiere of The Apprentice'
  },
  {
    filename: 'lisa-gilroy_sxsw_2025.jpg',
    size: 'xlportrait', // 1707x2560 (0.67 ratio - portrait)
    caption: 'Lisa Gilroy at SXSW 2025'
  },
  {
    filename: 'dave-franco_sundance_2025.jpg',
    size: 'portrait', // 2048x2560 (0.8 ratio - portrait)
    caption: 'Dave Franco at Sundance 2025'
  },
  {
    filename: 'conan-obrien_sundance_2024.jpg',
    size: 'portrait', // 1707x2560 (0.67 ratio - portrait)
    caption: "Conan O'Brien at Sundance 2024"
  },
  {
    filename: 'sebastian-stan.jpg',
    size: 'portrait', // 1707x2560 (0.67 ratio - portrait)
    caption: 'Sebastian Stan'
  },
  {
    filename: 'jude-law_tiff.jpg',
    cloudinaryPublicId: 'highlights/jay-dixit_red-carpet_01130',
    size: 'xlportrait', // 1707x2560 (0.67 ratio - portrait, featured)
    caption: 'Jude Law at the Toronto International Film Festival'
  },
  {
    filename: 'group-portrait_ana-de-armas-sydney-sweeney-ron-howard_2024.jpg',
    size: 'landscape', // 2560x1707 (1.5 ratio - landscape)
    caption: 'Ana de Armas, Sydney Sweeney, and Ron Howard'
  },
  {
    filename: 'vinod-khosla_sxsw.jpg',
    size: 'landscape', // 2560x1707 (1.5 ratio - landscape)
    caption: 'Vinod Khosla at SXSW'
  },
  {
    filename: 'emma-stone_nyff.jpg',
    size: 'portrait', // 1707x2560 (0.67 ratio - portrait)
    caption: 'Emma Stone at the New York Film Festival'
  },
  {
    filename: 'himesh-patel.jpg',
    size: 'portrait', // 2266x2560 (0.89 ratio - portrait)
    caption: 'Himesh Patel'
  },
  {
    filename: 'ella-hunt_toronto-film-festival.jpg',
    size: 'portrait', // 1707x2560 (0.67 ratio - portrait)
    caption: 'Ella Hunt at the Toronto Film Festival'
  },
  {
    filename: 'kaia-gerber_cory-michael-smith_saturday-night-sundance-premiere.jpg',
    size: 'portrait', // 1707x2560 (0.67 ratio - portrait)
    caption: 'Kaia Gerber and Cory Michael Smith at the Sundance premiere of Saturday Night'
  },
  {
    filename: 'nicholas-braun_toronto-film-festival.jpg',
    size: 'portrait', // 1707x2560 (0.67 ratio - portrait, NOT landscape)
    caption: 'Nicholas Braun at the Toronto Film Festival'
  },
  {
    filename: 'jay-dixit_red-carpet_05456.jpg',
    size: 'portrait', // 2048x2560 (0.8 ratio - portrait)
    caption: 'Rose Byrne'
  },
  {
    filename: 'Gabriel_LaBelle_at_the_2024_Toronto_International_Film_Festival_03_cropped.jpg',
    size: 'portrait', // 1583x2491 (0.64 ratio - portrait)
    caption: 'Gabriel LaBelle at the 2024 Toronto International Film Festival'
  },
  {
    filename: 'Jason_Collett_at_Ottawa_Jazz_Festival_in_2025_-_3.jpg',
    size: 'xlportrait', // 1706x2560 (0.67 ratio - portrait, NOT landscape)
    caption: 'Jason Collett at Ottawa Jazz Festival in 2025'
  },
  {
    filename: 'kieran-culkin_new-york-film-festival.jpg',
    size: 'portrait', // 1707x2560 (0.67 ratio - portrait, featured)
    caption: 'Kieran Culkin at the New York Film Festival'
  },
  {
    filename: 'jay-dixit_red-carpet_08042.jpg',
    size: 'landscape', // 2560x1707 (1.5 ratio - landscape)
    caption: 'Jay Dixit Red Carpet'
  },
  {
    filename: 'steven-yeun_sundance_2025.jpg',
    size: 'portrait', // 2048x2560 (0.8 ratio - portrait)
    caption: 'Steven Yeun at Sundance 2025'
  },
  {
    filename: 'Sydney_Sweeney_at_the_2024_Toronto_International_Film_Festival_(cropped_2).jpg',
    size: 'xlportrait', // Featured double-size image
    caption: 'Sydney Sweeney at the 2024 Toronto International Film Festival'
  },
  {
    filename: 'Ana_de_Armas_at_the_2024_Toronto_International_Film_Festival_02_(cropped2).jpg',
    size: 'portrait',
    caption: 'Ana de Armas at the 2024 Toronto International Film Festival'
  },
  {
    filename: 'Ana_de_Armas_and_Sydney_Sweeney_at_the_2024_Toronto_International_Film_Festival_04.jpg',
    size: 'xlportrait',
    caption: 'Ana de Armas and Sydney Sweeney at the 2024 Toronto International Film Festival'
  },
  {
    filename: 'Kaia_Gerber_at_the_2024_Toronto_International_Film_Festival_03_(cropped).jpg',
    size: 'portrait',
    caption: 'Kaia Gerber at the 2024 Toronto International Film Festival'
  },
  {
    filename: 'Willem_Dafoe_at_the_2024_Toronto_International_Film_Festival_02.jpg',
    size: 'portrait',
    caption: 'Willem Dafoe at the 2024 Toronto International Film Festival'
  },
  {
    filename: 'Frank_Oz_2024_Cropped.jpg',
    size: 'portrait',
    caption: 'Frank Oz 2024'
  },
  {
    filename: '2024-03-09_SXSW_Conan_Nick-Kroll_Office-Space_events_07141.jpg',
    size: 'portrait',
    caption: "Conan O'Brien at SXSW Office Space Event"
  },
  {
    filename: '2024-03-09_SXSW_Conan_Nick-Kroll_Office-Space_events_07162.jpg',
    size: 'portrait',
    caption: "Conan O'Brien at SXSW Office Space Event"
  },
  {
    filename: 'ron-livingston_sxsw-office-space-event_2024.jpg',
    cloudinaryPublicId: 'highlights/2024-03-09_SXSW_Conan_Nick-Kroll_Office-Space_events_07310',
    size: 'portrait',
    caption: 'Ron Livingston at SXSW Office Space Event'
  },
  {
    filename: '2024-03-09_SXSW_UCB_ASSSSCAT_10.jpg',
    size: 'portrait',
    caption: 'UCB ASSSSCAT at SXSW'
  },
  {
    filename: 'jason-bateman_tiff_2025.jpg',
    size: 'portrait',
    caption: 'Jason Bateman at the Toronto Film Festival.'
  },
  {
    filename: 'jason-bateman-jude-law_tiff_2025.jpg',
    size: 'landscape',
    caption: 'Jason Bateman and Jude Law at the Toronto Film Festival.'
  },
  {
    filename: 'jason-bateman-jude-law-09836_tiff_2025.jpg',
    size: 'landscape',
    caption: 'Jason Bateman and Jude Law at the Toronto Film Festival.'
  }
];
