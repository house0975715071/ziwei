// 讓複製出去的 lib/chart.js 用「import { astro } from '../iztro-shim.js'」拿到排盤核心。
// index.html 先用一般 <script src="vendor/iztro.min.js"> 載入 iztro（UMD，掛在 self.iztro），再載 app.js。
const lib = self.iztro;
if (!lib || !lib.astro) throw new Error('排盤核心沒有載入成功，請重新整理頁面');
export const astro = lib.astro;
