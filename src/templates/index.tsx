import { Talk } from '../generation/models.js'

interface BodyProps {
  talks: Record<string, Talk>
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
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

main {
  display: flex;
  flex-direction: column;
  width: 80%;
  max-width: 80vw;
  row-gap: 10ch;
}

nav {
  display: flex;
  flex-direction: column;
  row-gap: 6ch;
}

h1, h2, h4 {
  font-family: Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif,
    'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
  margin: 0;
  line-height: 1.4em;
}

h1 {
  font-size: 40pt;
}

h2 {
  font-size: 25pt;
}

h4 {
  color: #ecb22e;
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
`

export function body({ talks }: BodyProps): JSX.Element {
  return (
    <main>
      <h1>Slidesets</h1>
      <nav>
        {Object.entries(talks).map(([id, talk]) => (
          <a href={`/${id}`} key={`talk:${id}`}>
            <h2>{talk.document.title}</h2>
            <h4>{talk.document.author.name}</h4>
          </a>
        ))}
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
