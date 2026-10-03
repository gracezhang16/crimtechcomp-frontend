# Infinite Article Reader

## Overview

I built a reader that shows full articles and keeps loading more as the user scrolls, ten at a time. The user can search, see what article they are on, and refresh the page without losing their place.

The main page, `ReadPage.tsx`, connects several pieces: `useArticleFeed`, which keeps the list of loaded articles and knows how to fetch the next page; `useInfiniteScroll`, which notices when the user is near the bottom and fetches more articles; `useActiveArticle`, which figures out which article the user is reading; and `useDebouncedValue`, which waits until the user stops typing before running a search in the search feature.

Additionally, the `api/client.ts` file talks to the API with the articles and logs each request for articles. The `lib/feedStorage.ts` file saves the user's place in their scroll so they don't lose it when they refresh.

The components work as follows:
- `ArticleCard.tsx` displays one full article
- `ArticleNav.tsx` displays the sidebar list of articles
- `SearchBar.tsx` displays the search bar
- `FeedStates.tsx` displays loading, error, no results, and "You're all caught up"

When a user scrolls through the webpage, the page first loads the first 10 articles, with an invisible marker below the last one. When they scroll within a screen and a half of that marker, the app fetches the next 10 and adds them to the bottom. When there are no articles left, `hasMore` is false and "You're all caught up" shows up.

The optional features I added were the search function; current article tracking with the article the user is reading highlighted in the sidebar and shown in the URL; smart refresh with the user's loaded articles, scroll position, and search being preserved after refresh; and the two-column layout, with a navigation bar of articles next to the feed and a sticky header at the top.

## Challenges

Some challenges I faced were with the autoscroll in the navigation bar, because at first it was not very user friendly. At first, it listed all the loaded articles and scrolled at odd times, and could not be scrolled by the user. I changed it to just show the current group of 10 articles, with the highlight moving down as the user reads. When they reach the next group of 10, the list scrolls up to it. 

Another problem I faced was old search results showing up if you typed a new search when the old one was still loading. To fix this, I changed it so that a new search cancels the old request and ignores any response that doesn't match the current search.

## Design Choices

I made the webpage track the current article and when to load the next article by using the browser's IntersectionObserver, which reports when something comes into view on screen. This is better than tracking scrolls, because this can make the scrolling choppy. For loading, it watches an invisible marker below the last article. For tracking, it watches a line ~1/3 of the way down the screen, roughly where the user's eyes are while reading. Because articles are long and have varying lengths, the article crossing that line is a more reliable sign of what the user is reading than whichever article is most visible.

I installed DOMPurify to clean each article and ensure it is safe, because putting HTML from a server straight onto the page can allow harmful scripts to run.

I also separated each feature and component into a separate file to keep the codebase organized.

## AI Use

I used Claude throughout this project. I gave it details on the features I was trying to implement, and it walked me through which functions should go in which file and how each part works. I integrated the code into the starter project, set up the folder structure, resolved TypeScript errors, and tested everything in the browser. 

I did some iteration on user experience. I had the article column widened and the sidebar narrowed, and I redesigned how the sidebar behaves by making it show only the current set of 10 articles, with the highlight moving down and the list scrolling up to the next set, plus an animation for that transition. I also noticed the searching issue and investigated how to fix it. Claude told me how to implement and test those changes.
