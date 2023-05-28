import { Talk } from '../generation/models.js'

interface BodyProps {
  talk: Talk
  talkAssets: [string, string][]
  themeAssets: [string, string][]
}

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
  margin: 0;
  display: flex;
  justify-content: center;
  width: 100%;
  min-height: 100%;
}

main {
  display: flex;
  flex-direction: column;
  width: 95%;
  max-width: 95vw;
  margin: 20pt;
}

nav {
  display: flex;
  flex-direction: column;
  row-gap: 6ch;
}

h1, h2, h3, h4 {
  font-family: Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif,
    'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
  margin: 0;
  line-height: 1.4em;
}

h1 {
  font-size: 35pt;
  color: #2165e3;
}

h2 {
  font-size: 25pt;
  color: #ecb22e;
}

h3 {
  font-size: 25pt;
  margin-top: 3ch;
}


a,
a:hover,
a:active,
a:visited,
a:focus {
  color: #2165e3;
  text-decoration: none;
}

a:hover, a:hover h4 {
  color: #fb7a9c;
}

nav {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(4, minmax(200px, 1fr));
  column-gap: 1ch;
  row-gap: 1ch;
}

section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  border: 2px solid #e0e0e0;
  border-radius: 5px;
  padding: 2ch;
  box-shadow: 5px 5px 10px -5px #C0C0C0;
  row-gap: 2ch;
}

section:hover {
  background-color: #F0F0F0;
}

section div {
  flex: 1;
  display: flex;
  align-items: center;
}

section img {
  min-width: 200px;
  min-height: 200px;
  max-width: 100%;
  max-height: 200px;
}

section h4 {
  white-space: nowrap;
}
`

export function body({ talk, talkAssets, themeAssets }: BodyProps): JSX.Element {
  return (
    <main>
      <h2>Assets</h2>
      <h1>{talk.document.title}</h1>

      <h3>Talk Assets</h3>

      <nav>
        {talkAssets.map(([path, url]) => {
          return (
            <section key={path}>
              <div>
                <img src={url} />
              </div>
              <h4>{path}</h4>
            </section>
          )
        })}
      </nav>

      <h3>Theme Assets</h3>

      <nav>
        {themeAssets.map(([path, url]) => {
          return (
            <section key={path}>
              <div>
                <img src={url} />
              </div>
              <h4>{path}</h4>
            </section>
          )
        })}
      </nav>
    </main>
  )
}

export function page(): JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Slidesets</title>
        <link
          rel="preload"
          as="font"
          crossOrigin="anonymous"
          href="https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLCz7Z1xlFd2JQEk.woff2"
        />
        <style dangerouslySetInnerHTML={{ __html: style }} />
      </head>
      <body>@BODY@</body>
    </html>
  )
}
