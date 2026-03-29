import KimiCategoryPage from './jenks-v2/KimiCategoryPage';

export default function Fabrics() {
  return (
    <KimiCategoryPage
      pageType="FABRIC_TO_BUY"
      kind="FABRIC"
      pageLabel="Fabrics To Buy"
      routeBase="/fabrics"
      defaultBanner="/images/hero-fabrics.jpg"
      defaultSubtitle="Choose quality fabrics by fabric category and country."
    />
  );
}
