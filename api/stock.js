const HANDLES = [
  'cbd-rub-muscles-joints',
  'cbd-sleep-oil-cbd-cbn-oil-blend',
  'cbd-3oz-roll-on-cooling-gel',
  'cbd-sleep-gummies'
];

// Upsell items shown in the cart drawer across all pages
const UPSELL_VIDS = [
  '44961396850842',  // CBD Tension & Stress Tablets
  '31697798758490',  // CBD Oil – Full-Spectrum Blend
  '44870948126874',  // CBD Mood & Calm Tablets
  '44623478161562',  // CBD Calming Gummies
  '31582445305946'   // CBD Sleep Support Tablets
];

module.exports = async function(req, res) {
  try {
    const [productResults, variantResults] = await Promise.all([
      Promise.all(
        HANDLES.map(h =>
          fetch(`https://zebracbd.com/products/${h}.js`)
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + h); return r.json(); })
        )
      ),
      Promise.all(
        UPSELL_VIDS.map(vid =>
          fetch(`https://zebracbd.com/variants/${vid}.js`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        )
      )
    ]);
    const stock = {};
    productResults.forEach(product => {
      product.variants.forEach(v => {
        stock[String(v.id)] = { available: v.available };
      });
    });
    variantResults.forEach(v => {
      if (v) stock[String(v.id)] = { available: v.available };
    });
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(stock);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
};
