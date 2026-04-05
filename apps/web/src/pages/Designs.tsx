import KimiCategoryPage from './jenks-v2/KimiCategoryPage';

export default function Designs() {
  return (
    <KimiCategoryPage
      pageType="CUSTOM_TO_WEAR"
      kind="CUSTOM"
      pageLabel="Custom To Wear"
      routeBase="/jenks-v14/custom-to-wear"
      defaultBanner="/images/hero-designs.jpg"
      defaultSubtitle="Discover custom designs from top fashion designers."
    />
  );
}
