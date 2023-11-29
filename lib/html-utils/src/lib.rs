extern crate console_error_panic_hook;

use std::panic;

use lol_html::{element, rewrite_str, RewriteStrSettings};
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = "singleSlide")]
pub fn single_slide(html: &str, slide: u32) -> String {
  rewrite_str(
    html,
    RewriteStrSettings {
      element_content_handlers: vec![
        element!("[data-freya-id=\"slide\"]", |el| {
          if let Some(value) = el.get_attribute("data-freya-index") {
            if value.parse::<u32>().unwrap() != slide {
              el.remove();
            }
          }

          Ok(())
        }),
        element!("[data-freya-id=\"loading\"]", |el| { el.remove(); Ok(()) }),
        element!("[data-freya-id=\"list:container\"]", |el| { el.remove(); Ok(()) }),
        element!("[data-freya-id=\"presenter:container\"]", |el| { el.remove(); Ok(()) }),
        element!("body", |el| { 
          let _ = el.set_attribute("style", "display: block; overflow: auto");
          Ok(()) 
        })
      ],
      ..RewriteStrSettings::default()
    },
  )
  .unwrap()
}

#[wasm_bindgen(start)]
fn start() { panic::set_hook(Box::new(console_error_panic_hook::hook)); }

#[wasm_bindgen]
extern "C" {
  #[wasm_bindgen(js_namespace = console)]
  fn log(s: &str);
}
