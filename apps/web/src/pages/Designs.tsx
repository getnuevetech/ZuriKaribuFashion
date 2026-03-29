import KimiCategoryPage from './jenks-v2/KimiCategoryPage';

export default function Designs() {
  return (
    <KimiCategoryPage
      pageType="CUSTOM_TO_WEAR"
      kind="CUSTOM"
      pageLabel="Custom To Wear"
      routeBase="/custom"
      defaultBanner="/images/hero-designs.jpg"
      defaultSubtitle="Discover custom designs from top fashion designers."
    />
  );
}
