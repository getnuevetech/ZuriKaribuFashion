import KimiCategoryPage from './jenks-v2/KimiCategoryPage';

export default function ReadyToWear() {
  return (
    <KimiCategoryPage
      pageType="READY_TO_WEAR"
      kind="READY"
      pageLabel="Ready To Wear"
      routeBase="/ready-to-wear"
      defaultBanner="/images/hero-readytowear.jpg"
      defaultSubtitle="Shop ready styles from designers across Africa."
    />
  );
}
