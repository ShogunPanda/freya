use scraper::{Html, Selector};
use js_sys::{JsString};
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = "extractImages")]
pub fn extract_images(html: &str) -> Vec<JsString> {
    let document = Html::parse_document(html);
    let selector = Selector::parse("img[src]").unwrap();
    let mut images = vec![];

    for element in document.select(&selector) {
        let attr = element.attr("src");

        if attr.is_some() {
            images.push(attr.unwrap().into());
        }
    }

    images
}
