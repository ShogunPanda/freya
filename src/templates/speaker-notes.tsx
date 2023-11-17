import { Fragment } from 'react'
import { renderNotes } from '../slidesets/generators.js'
import { type Talk } from '../slidesets/models.js'

const style = `
*,
*:hover,
*:focus,
*:active,
*::before,
*::after {
  box-sizing: border-box;
  outline: none;
}

@font-face {
  font-family: 'Poppins';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLCz7Z1xlFd2JQEk.woff2) format(woff2);
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074,
    U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

body {
  font-family: Lexend, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif,
    'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
  font-weight: 200;
  margin: 20px;
}

h1 {
  font-family: Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif,
    'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
  margin: 0;
  line-height: 1.4em;
}
`

export function speakerNotes(talk: Talk): JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`Speaker Notes - ${talk.document.title}`}</title>
        <link
          rel="preload"
          as="font"
          crossOrigin="anonymous"
          href="https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLCz7Z1xlFd2JQEk.woff2"
        />
        <link
          rel="preload"
          as="font"
          crossOrigin="anonymous"
          href="https://fonts.gstatic.com/s/lexend/v17/wlpwgwvFAVdoq2_v-6QU82RHaA.woff2"
        />
        <style dangerouslySetInnerHTML={{ __html: style }} />
      </head>
      <body>
        <h1>Speaker Notes - {talk.document.title}</h1>

        {talk.slides.map((s, index) => {
          if (s.notes?.length === 0) {
            return undefined
          }
          return (
            <Fragment key={index}>
              <h2>
                Slide {index.toString().padStart(talk.slidesPadding, '0')}/{talk.slidesCount}: &nbsp;
                <span dangerouslySetInnerHTML={{ __html: s.title }} />
              </h2>

              <div dangerouslySetInnerHTML={{ __html: renderNotes(s) }} />
            </Fragment>
          )
        })}
      </body>
    </html>
  )
}
