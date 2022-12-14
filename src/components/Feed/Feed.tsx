import { Box, Container, Loader } from '@mantine/core'
import { useCallback, useEffect, useRef } from 'react'
import { useMe } from '../../hooks/useMe'
import { Pages } from '../../types/app.types'
import { trpc } from '../../utils/trpc'
import PostCard from './Post/PostCard'
import Suggestions from './Suggestions'
import SuggestionsCarousel from './SuggestionsCarousel'

const DisplayPosts = ({ pages }: { pages: Pages }) => {
  return (
    <>{pages!.map(({ feed }) => feed.map((post: typeof feed[number]) => <PostCard key={post.id} post={post} />))}</>
  )
}

const Feed = () => {
  const observerElem = useRef<HTMLDivElement>(null)
  const suggestionsQuery = trpc.useQuery(['feed.get-suggestions'])
  const { me } = useMe()
  const feedQuery = trpc.useInfiniteQuery(['feed.get-feed', { limit: 5 }], {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
  
  const pages = feedQuery.data?.pages
  const suggestions = suggestionsQuery.data!.suggestions
  // observe ref element, if its entered the viewport, fetch next page
  const handleObserver = useCallback(
    (entries: any) => {
      const [target] = entries
      if (target.isIntersecting) {
        feedQuery.fetchNextPage()
      }
    },
    [feedQuery.fetchNextPage, feedQuery.hasNextPage]
  )

  useEffect(() => {
    const element = observerElem.current
    const option = { threshold: 0 }
    const observer = new IntersectionObserver(handleObserver, option)
    observer.observe(element as Element)

    return () => observer.unobserve(element as Element)
  }, [feedQuery.fetchNextPage, feedQuery.hasNextPage, handleObserver])

  return (
    <Container
      px={0}
      py='2rem'
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        flexDirection: 'row',
      }}>
      <Container
        px={0}
        sx={{
          width: '100%',
          maxWidth: '480px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem',
        }}>
        {pages && <DisplayPosts pages={pages} />}

        {/* If loading and has more posts show loader, else null */}
        <Box ref={observerElem} sx={{ display: 'flex', justifyContent: 'center' }}>
          {feedQuery.isFetching && feedQuery.hasNextPage ? (
            <Loader color='gray' size='md' sx={{ justifySelf: 'center' }} />
          ) : (
            ''
          )}
        </Box>
        {suggestions.length > 0 && <SuggestionsCarousel suggestions={suggestions} />}
      </Container>

      {suggestions.length > 0 && (
        <Suggestions name={me?.profile.name} avatar={me?.profile.avatar} suggestions={suggestions} />
      )}

    </Container>
  )
}

export default Feed
