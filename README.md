# 📸 Photos Jaydixit

[![Build & Test](https://github.com/incandescentman/photos-jaydixit/actions/workflows/test.yml/badge.svg)](https://github.com/incandescentman/photos-jaydixit/actions/workflows/test.yml)

A modern, fast, and highly customizable photography portfolio template built with [Astro](https://astro.build).
Ideal for photographers who want to showcase their work through a sleek, performant, and professional website.

👉 [View the demo](https://incandescentman.github.io/photos-jaydixit/)

## ✨ Features

- Lightning-fast performance with Astro
- Fully responsive design
- **Cloudinary CDN** for homepage images (automatic format negotiation, edge caching)
- Optimized image loading with lazy loading and responsive srcsets
- Easy to customize
- Easy to organized gallery via a yaml file
- Multiple albums support
- PhotoSwipe lightbox for full-screen viewing
- Packery.js masonry layout
- Automatic deployment to Vercel
- Script to upload images to Cloudinary

## 🚀 Getting Started

### Prerequisites

- Check [AstroJS](https://docs.astro.build/en/install-and-setup/) documentation for prerequisites
- Basic knowledge of Astro and web development

### Installation

1. click "Use this template" on GitHub
2. Clone your newly created template
3. Install dependencies:

```bash
pnpm install
# or
yarn install
```

3. Start the development server:

```bash
pnpm run dev
# or
yarn dev
```

## 📝 Make it your own

### Configuration

Edit the `astro.config.ts` file to update your github pages details:

```typescript
export default defineConfig({
  site: '<github pages domain>',
  base: '<repository name>',
  // ...
});
```

Edit the `site.config.mts` file to update your personal information:

```typescript
export default {
  title: 'SR',
  favicon: 'favicon.ico',
  owner: 'Sara Richard',
  // ... Other configurations
};
```

### Customize site icon

Replace `public/favicon.ico` with your icon and change the configuration
if your file has a different name/location.

### Customize the About page

- Replace the profile image (see [site.config.mts](site.config.mts) for configuration)
- Edit content in [about page](./src/pages/about.astro)

### Adding Your Photos

1. Place your images in the `src/gallery/<album>` directory
2. Update the gallery details in `src/gallery/gallery.yaml`. Optionally, you can run `pnpm run generate` to generate a
   gallery.yaml file from the images in the directory.
3. Update meta-data for images in the `src/gallery/gallery.yaml` file.
4. Images are automatically optimized during build

### Adding photos to the featured section

"featured" is a builtin collection, and images can be added to it by specifying it in the collections parameter like any
other collection.

## 🛠️ Built With

- [Astro](https://astro.build) - The web framework for content-driven websites
- [Cloudinary](https://cloudinary.com) - Image CDN with automatic optimization
- [TypeScript](https://www.typescriptlang.org/) - For type safety
- [TailwindCSS](https://tailwindcss.com) - For styling
- [PhotoSwipe](https://photoswipe.com/) - Full-screen lightbox gallery
- [Packery](https://packery.metafizzy.co/) - Masonry layout engine
- [Sharp](https://sharp.pixelplumbing.com/) - For gallery image optimization

## ⚙️ Provided GitHub actions

- [Build & Test](./.github/workflows/test.yml) - Ensure build integrity
- [Quality](./.github/workflows/quality.yml) - Run pre-commit checks
- [Deploy Astro Site](./.github/workflows/deploy.yml) - Publish to GitHub pages

## 📄 License

This project is licensed under the MIT License, see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request or an Issue.

## 💖 Support

If you find this template useful, please consider giving it a ⭐️ on GitHub!

## 📧 Contact

- [Instagram](https://www.instagram.com/lesegal/)
- [GitHub](https://github.com/rockem)
