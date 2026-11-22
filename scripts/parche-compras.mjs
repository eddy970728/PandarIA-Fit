// 1.9.1 · Parche del plugin de compras (@capgo/native-purchases 8.9.6, Android).
// El plugin ignora el offerToken en las suscripciones y compra la primera oferta del plan base que encuentra,
// así que la prueba de 3 días podía no aplicarse aunque Google Play la ofreciera. Con este parche, si la app
// manda un offerToken que coincide con una oferta del producto, se compra exactamente esa oferta.
// Si el texto del plugin cambia (otra versión), la compilación se detiene para no publicar una app sin el arreglo.
import fs from 'node:fs';
const f = 'node_modules/@capgo/native-purchases/android/src/main/java/ee/forgr/nativepurchases/NativePurchasesPlugin.java';
let s = fs.readFileSync(f, 'utf8');
const MARCA = '/* pandaria: offerToken */';
if (s.includes(MARCA)) { console.log('Parche de compras ya aplicado'); process.exit(0); }
const a = `                                ProductDetails.SubscriptionOfferDetails selectedOfferDetails = null;
                                assert productDetailsItem.getSubscriptionOfferDetails() != null;`;
const b = `                                ProductDetails.SubscriptionOfferDetails selectedOfferDetails = null;
                                assert productDetailsItem.getSubscriptionOfferDetails() != null;
                                ${MARCA}
                                if (offerToken != null && !offerToken.isEmpty()) {
                                    for (ProductDetails.SubscriptionOfferDetails od : productDetailsItem.getSubscriptionOfferDetails()) {
                                        if (offerToken.equals(od.getOfferToken()) && od.getBasePlanId().equals(planIdentifier)) { selectedOfferDetails = od; break; }
                                    }
                                }`;
const n = s.split(a).length - 1;
if (n !== 1) { console.error('ERROR: no se encontró el punto del parche de compras (' + n + ' coincidencias)'); process.exit(1); }
s = s.replace(a, b);
// el bucle original solo busca si no se eligió ya la oferta pedida
const c = `                                for (ProductDetails.SubscriptionOfferDetails offerDetails : productDetailsItem.getSubscriptionOfferDetails()) {
                                    NativePurchasesLog.d(TAG, "Checking offer: " + offerDetails.getBasePlanId());`;
const d = `                                if (selectedOfferDetails == null) for (ProductDetails.SubscriptionOfferDetails offerDetails : productDetailsItem.getSubscriptionOfferDetails()) {
                                    NativePurchasesLog.d(TAG, "Checking offer: " + offerDetails.getBasePlanId());`;
if (s.split(c).length - 1 !== 1) { console.error('ERROR: no se encontró el bucle de ofertas del plugin de compras'); process.exit(1); }
s = s.replace(c, d);
fs.writeFileSync(f, s);
console.log('Parche de compras aplicado: se respeta la oferta (prueba gratis) que elige la app');
