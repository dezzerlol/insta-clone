import { MantineProvider } from '@mantine/core'
import { httpBatchLink } from '@trpc/client/links/httpBatchLink'
import { loggerLink } from '@trpc/client/links/loggerLink'
import { withTRPC } from '@trpc/next'
import type { NextComponentType } from 'next'
import { SessionProvider } from 'next-auth/react'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import NextNProgress from 'nextjs-progressbar'
import superjson from 'superjson'
import Layout from '../components/Layout'
import { url } from '../constants/url.const'
import { AppRouter } from '../server/router/app.router'

type CustomAppProps = AppProps & {
  Component: NextComponentType & { noHeader?: boolean }
}

function MyApp({ Component, pageProps: { session, ...pageProps } }: CustomAppProps) {
  return (
    <>
      <Head>
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
      </Head>

      <SessionProvider session={session}>
        <MantineProvider withGlobalStyles withNormalizeCSS>
          <NextNProgress
            color='linear-gradient(90deg, rgba(121,9,88,1) 0%, rgba(228,191,23,1) 50%, rgba(121,9,88,1) 100%)'
            options={{ showSpinner: false, easing: 'ease', speed: 400 }}
            showOnShallow={false}
          />
          {Component.noHeader ? (
            <Component {...pageProps} />
          ) : (
            <Layout>
              <Component {...pageProps} />
            </Layout>
          )}
        </MantineProvider>
      </SessionProvider>
    </>
  )
}

export default withTRPC<AppRouter>({
  config({ ctx }) {
    const links = [loggerLink(), httpBatchLink({ maxBatchSize: 10, url })]

    return {
      queryClientConfig: {
        defaultOptions: {
          queries: {
            staleTime: Infinity,
            /* refetchOnWindowFocus: false, */
            /* refetchOnReconnect: false, */
          },
        },
      },
      headers() {
        if (ctx?.req) {
          return { ...ctx.req.headers, 'x-ssr': '1' }
        }
        return {}
      },
      links,
      transformer: superjson,
    }
  },
  ssr: false,
})(MyApp)

// TODO:
// feed live updates
// change get-profile in useMe hook for get-account
// BUG:
// next js progress bar showing with shallow = false
