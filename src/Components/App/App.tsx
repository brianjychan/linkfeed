import React, { useEffect, useState, useCallback } from "react";
import { API, graphqlOperation, Auth, Amplify } from "aws-amplify";
import psl from 'psl'
import { GraphQLResult } from '@aws-amplify/api'

import { Post } from "../../models";
import { createPost, updatePost, deletePost } from "../../graphql/mutations";
import { GetPostQuery, ListPostsByTimeQuery, ModelSortDirection, ListPostsByChannelQuery } from "../../API";
import { listPostsByTime, listPostsByChannel, getPost } from '../../graphql/queries';

import { UtilityContext, Utility, useUtility } from "../Utility";
import photo from '../../assets/photo.png'
import styles from './App.module.css'

// Get Posthog Event Analytics
// https://posthog.com
// @ts-ignore
import posthog from 'posthog-js';

// Uncomment me during set up to create your user
// import { withAuthenticator } from '@aws-amplify/ui-react'
// --------------

function extractHostname(target_url: string) {
  var hostname
  //find & remove protocol (http, ftp, etc.) and get hostname

  if (target_url.indexOf('//') > -1) {
    hostname = target_url.split('/')[2]
  }
  else {
    hostname = target_url.split('/')[0]
  }

  //find & remove port number
  hostname = hostname.split(':')[0]
  //find & remove '?'
  hostname = hostname.split('?')[0]

  return hostname
}

interface ChannelMap {
  [x: string]: string
}
const CHANNEL_NAME_MAP: ChannelMap = {
  'njEKszjwbeX4ZroWlhbE': 'Some Channel Name',
  'JvboU0Adth7Q6yuLHcbv': 'Second Channel Name',
  '7ExtTHreafiHC4mGl3h1': 'Private Personal',
  'ImPy7KgHIhs7glpv2gUm': 'Private Work',
  // 'Pk181Y7ja0ArK9VVWGhC': '',
  // 'dxnN5aUV6QEZTawp8y3H': '',
  // 'pS2tGkEUEgisBP3U0AjY': '',
  // '70Uzs5qL1LNkwNJBjEbR': '', 
  // 'r7XXKChPM1tXE9V8Piud': '', 
  // 'NDh2qO4TiqkYkCmUt6I0': '', 
  // 'ogRudBB5KfMEmMeX4ZdE': '', 
  // 'GzGdEDKtzmC7MZM4XQc2': '', 
  // 'CjBnhXxixGJmXsEczJQT': '', 
  // 'IK5LXUMOSNj7ae4Ap3Ut': '',
  // 'zVz3MjzOGdeZ5rJML9OX': '', 
  // 'YmsAT7yNazsB2w0mj8wD': '', 
  // 'kEfxmLEDQ2c8g4vlGIgb': '', 
  // 'Y4pbzS4756NLKejZSayU': '', 
  // 'aJQoilmi8A5Mx8R7QJxO': '', 
  // 'EgInSEq02qpH2wqw7U3g': '',
  //'JX0ZFeEGHxseZ5sFxQZS': '',
  // 'gzMoxiNxap9hueEmmbfY': '',
  // 'LJDMpgh7sYxu7Ddg8O2H': '',
}

// Add Channel Codes here if you want them to be filtered out and made invisible to the public--then only you can add links / view them.
// Note that this done client-side which is always a no-no--if someone REALLY wanted to they could edit the client-side code and see that channel.
const SECRET_CHANNELS = [
  '7ExtTHreafiHC4mGl3h1', // Private Personal
  'ImPy7KgHIhs7glpv2gUm', // Private Work
]

const INIT_TIME = { start: Date.now() / 1000, end: Date.now() / 1000 }

const SignInComponent: React.FC = () => {
  const [inputs, setInputs] = useState({ email: '', pw: '' })
  const [error, setError] = useState(false)

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setInputs(prev => ({ ...prev, [name]: value }))
  }

  const doSignIn = async () => {
    try {
      Auth.signIn(inputs.email, inputs.pw)
    } catch (error) {
      console.log(error)
      setError(true)
    }
  }

  const { email, pw } = inputs
  return (
    <div>
      <p>email</p>
      <input onChange={handleChange} name="email" value={email} autoComplete="email" />
      <p>pw</p>
      <input onChange={handleChange} name="pw" value={pw} autoComplete="password" type="password" />
      <button onClick={doSignIn}>Sign in</button>
      {error && <p>Error signing in</p>}
    </div>
  )
}

const AddPostComponent: React.FC = () => {
  const [inputs, setInputs] = useState({ url: '', caption: '' })
  const [busy, setBusy] = useState(false)

  // Handle text input for adding a new post
  const handleAdd = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value, name } = event.target
    setInputs(prev => ({ ...prev, [name]: value }))
  }

  const uploadToChannel = (channelCode: string) => async () => {
    const { url, caption } = inputs
    if (!url) {
      return
    }
    setBusy(true)
    try {
      const seconds = Math.trunc(Date.now() / 1000)
      const newPostData: Post = {
        url,
        caption,
        channelCode,
        type: 'link',
        time: seconds,

        id: '',

        title: '',
        imgUrl: '',
        desc: '',
      }
      await API.graphql(graphqlOperation(createPost, { input: newPostData }))
      setInputs({ url: '', caption: '' })
    } catch (error) {
      console.log(error)
    }


    setBusy(false)
  }

  const sortFunction = (channelCode: string, channelCodeTwo: string) => {
    const name1 = CHANNEL_NAME_MAP[channelCode]
    const name2 = CHANNEL_NAME_MAP[channelCodeTwo]
    if (name1 < name2) {
      return -1
    } else {
      return 1
    }
  }

  const { url, caption } = inputs
  // Render Channel Buttons
  const renderedChannels = Object.keys(CHANNEL_NAME_MAP).sort(sortFunction).map(channelCode => {
    const channelName = CHANNEL_NAME_MAP[channelCode]
    const colorStyle = url ? '' : 'colorGray'
    const addPointerStyle = url ? styles.pointer : ''

    const spanStyle = [colorStyle, addPointerStyle].join(' ')

    return (
      <div key={channelCode} className={styles.channelSelection} onClick={uploadToChannel(channelCode)}>
        <span className={spanStyle}>{channelName}</span>
      </div>
    )
  })
  return (
    <div className={styles.addPostArea}>
      <p>New Post</p>
      <input className={styles.addBox} onChange={handleAdd} value={url} name={"url"} placeholder="url" />
      <input className={styles.addBox} onChange={handleAdd} value={caption} name={"caption"} placeholder="caption" />
      <div>
        {url && ((busy) ? <p>Uploading...</p> : renderedChannels)}
      </div>
    </div>
  )
}

interface LinkItemProps {
  mode: string;
  post: Post;
  index: number;
}




const App = () => {
  const utility = useUtility()

  // Inputs
  const [timeBorders, setTimeBorders] = useState(INIT_TIME)
  const [pageNum, setPageNum] = useState(0)
  const [chosenChannelCode, setChosenChannelCode] = useState('')


  // Data
  const [feedPosts, setFeedPosts] = useState<Array<Post>>([]);
  const [error, setError] = useState(false)
  const [pinnedLink, setPinnedLink] = useState<Post>({} as Post)

  // UI
  const [choseAuthMode, setChoseAuthMode] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  const [firstLoadDone, setFirstLoadDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pinnedLoading, setPinnedLoading] = useState(true)

  const [noMorePosts, setNoMorePosts] = useState(false)

  // Get the Pinned post
  const fetchPinned = useCallback(async () => {
    try {
      const pinnedData = await API.graphql(graphqlOperation(getPost, { id: 'pinned' })) as GraphQLResult<GetPostQuery>
      const retrievedPinnedLink = pinnedData.data?.getPost as Post
      if (retrievedPinnedLink) {
        setPinnedLink(retrievedPinnedLink)
      }
    } catch (error) {
      console.log(error)
    }
    setPinnedLoading(false)
  }, [])

  const setPinned = useCallback(async (linkToPinData: Post) => {
    try {
      const newPinnedData: Post = {
        url: linkToPinData.url,
        caption: linkToPinData.caption,
        channelCode: linkToPinData.channelCode,
        type: linkToPinData.type,
        time: linkToPinData.time,
        title: linkToPinData.title,
        imgUrl: linkToPinData.imgUrl,
        desc: linkToPinData.desc,

        id: 'pinned',

      }
      if (pinnedLink.id) {
        // Reupload the previously pinned entry as a regular one
        const oldPinnedData: Post = {
          url: pinnedLink.url,
          caption: pinnedLink.caption,
          channelCode: pinnedLink.channelCode,
          type: 'link',
          time: pinnedLink.time,
          title: pinnedLink.title,
          imgUrl: pinnedLink.imgUrl,
          desc: pinnedLink.desc,
          id: ''
        }
        await API.graphql(graphqlOperation(createPost, { input: oldPinnedData }))
        // Update the pinned entry
        await API.graphql(graphqlOperation(updatePost, { input: newPinnedData }))
      } else {
        // No previously pinned entry, so just create a new one
        await API.graphql(graphqlOperation(createPost, { input: newPinnedData }))
      }
      // Either way, delete the regular entry for the one we just pinned
      await API.graphql(graphqlOperation(deletePost, { input: { id: linkToPinData.id } }))
      setPinnedLink(linkToPinData)
    } catch (error) {
      console.log('Error pinning post')
      console.error(error)
    }
  }, [pinnedLink])

  const removePinned = useCallback(async () => {
    try {
      // Reupload the previously pinned entry as a regular one
      const oldPinnedData: Post = {
        url: pinnedLink.url,
        caption: pinnedLink.caption,
        channelCode: pinnedLink.channelCode,
        type: 'link',
        time: pinnedLink.time,
        title: pinnedLink.title,
        imgUrl: pinnedLink.imgUrl,
        desc: pinnedLink.desc,
        id: ''
      }
      await API.graphql(graphqlOperation(createPost, { input: oldPinnedData }))
      // Delete the now-duplicate pinned entry
      await API.graphql(graphqlOperation(deletePost, { input: { id: 'pinned' } }))
      setPinnedLink({} as Post)
      // Insert into posts
    } catch (error) {
      console.log(error)
    }
  }, [pinnedLink])

  // Fetch posts of a certain pagination direction and channelCode
  const fetchPosts = useCallback(async (getEarlier: boolean, channelCode: string) => {
    setLoading(true)
    const ITEMS_TO_LOAD = 12

    try {
      const timeBounds = getEarlier ? { lt: timeBorders.start } : { gt: timeBorders.end }
      const sortDirection = getEarlier ? ModelSortDirection.DESC : ModelSortDirection.ASC
      let newPosts = []
      // Note that we repeat code based on if it's sorting by channelCode or not, keep in mind when editing
      if (channelCode) {
        const postData = await API.graphql(graphqlOperation(listPostsByChannel, { channelCode, time: timeBounds, sortDirection, limit: ITEMS_TO_LOAD })) as GraphQLResult<ListPostsByChannelQuery>
        newPosts = postData.data?.listPostsByChannel?.items as Array<Post>;
        if (!postData.data?.listPostsByChannel?.nextToken && getEarlier) {
          setNoMorePosts(true)
        } else {
          setNoMorePosts(false)
        }
      } else {
        const postData = await API.graphql(graphqlOperation(listPostsByTime, { type: "link", time: timeBounds, sortDirection, limit: ITEMS_TO_LOAD })) as GraphQLResult<ListPostsByTimeQuery>
        newPosts = postData.data?.listPostsByTime?.items as Array<Post>;
        if (!postData.data?.listPostsByTime?.nextToken && getEarlier) {
          setNoMorePosts(true)
        } else {
          setNoMorePosts(false)
        }
      }
      if (newPosts.length) {
        // Set Time Bounds
        if (!getEarlier) {
          // Since we're looking for later posts but retrieved them in ascending time, reverse
          newPosts.reverse()
        }
        const earliestTime = newPosts[newPosts.length - 1].time as number
        const latestTime = newPosts[0].time as number
        const newBorders = { start: earliestTime, end: latestTime }
        setTimeBorders(newBorders)
        setFeedPosts(newPosts);
      } else {
        const newBorders = { start: 0, end: timeBorders.start - .5 }
        setTimeBorders(newBorders)
        console.log('No posts')
      }
    } catch (err) {
      console.log(err)
      console.log("error fetching posts");
      setError(true)
    }
    setLoading(false)
  }, [timeBorders])

  // Check Auth
  useEffect(() => {
    // Replace this string with your email 
    const emailString = 'yourEmailHere@gmail.com'
    const getUser = async () => {
      try {
        const user = await Auth.currentAuthenticatedUser()
        if (user.attributes.email === emailString) {
          try {
            posthog.identify('Me')
            posthog.opt_out_capturing();
          } catch (error) {
            console.log(error)
          }
          Amplify.configure({
            "aws_appsync_authenticationType": "AMAZON_COGNITO_USER_POOLS",
          });
          setShowAdd(true)
        }
      } catch (error) {
        console.log(error)
      }
      setChoseAuthMode(true)
    }
    getUser()
  }, [])

  // Initiate First Load
  useEffect(() => {
    if (firstLoadDone || !choseAuthMode) {
      return
    }
    setFirstLoadDone(true)
    fetchPosts(true, chosenChannelCode)
    fetchPinned()
  }, [firstLoadDone, choseAuthMode, chosenChannelCode, fetchPinned, fetchPosts]);

  const LinkItem: React.FC<LinkItemProps> = ({ post, mode, index }) => {
    const [expanded, setExpanded] = useState(false)

    const { id, url, title, caption } = post

    const channelCode = post.channelCode as string
    const time = (post.time as number) * 1000
    const domainName = psl.get(extractHostname(url))

    // Please refer to the README; this client-side filtering is NOT secure.
    if ((SECRET_CHANNELS.includes(channelCode) && !showAdd)
      || !url
      || (mode === "feed" && (id === 'pinned' || post.time === pinnedLink.time))
    ) {
      return null
    }

    const chooseChannelCode = () => {
      setFeedPosts([])
      setPageNum(0)
      setTimeBorders(INIT_TIME)
      setFirstLoadDone(false)
      setChosenChannelCode(channelCode)
      setNoMorePosts(false)
    }

    const captionStyle = expanded ? '' : styles.truncatedCaption

    return (
      <div key={id ? id : index} className={styles.post} >
        {mode === 'pinned' && <p className={["colorGray", styles.pinnedLabel].join(' ')}>Pinned</p>}
        <p><a href={url} target="_blank" rel="noopener noreferrer">{title ? title : url}</a><span className="colorGray">&nbsp;&nbsp;&nbsp;({domainName})</span></p>


        {caption &&
          <div>
            <div className={styles.captionArea}>
              <div className={styles.captionHolder}>
                <p className={captionStyle}
                  onClick={() => setExpanded(true)}
                >
                  <img alt="website-owner-pic" src={photo} className={styles.photo} />
                  {caption}
                </p>

                {/* {expanded ?
                  <p className={styles.caption}>{caption}</p>
                  :
                  <Truncate lines={3} ellipsis={<span  className={[styles.moreButton, "colorGray"].join(' ')}>... More</span>}>
                    {caption}
                  </Truncate>
                } */}
              </div>
            </div>
          </div>
        }
        <p className="colorGray">
          {utility.getTimeText(time)}&nbsp;&nbsp;-&nbsp;&nbsp;
          <span onClick={chooseChannelCode} className={styles.channelCode}>{CHANNEL_NAME_MAP[channelCode]}</span>
          {showAdd &&
            (mode === 'pinned' ?
              <span onClick={() => { removePinned() }} className={styles.pinButton}>&nbsp;&nbsp;-&nbsp;&nbsp;Unpin</span>
              :
              <span onClick={() => { setPinned(post) }} className={styles.pinButton}>&nbsp;&nbsp;-&nbsp;&nbsp;Pin</span>)
          }

        </p>
      </div >
    )
  }

  // Render the posts
  const renderPosts = (postsArray: Array<Post>, mode: string) => {
    return postsArray.map((post: Post, index: number) => <LinkItem post={post} index={index} mode={mode} key={index} />)
  }


  const loadNextPage = (getEarlier: boolean) => () => {
    setFeedPosts([])
    setPageNum(prev => getEarlier ? prev + 1 : prev - 1)
    fetchPosts(getEarlier, chosenChannelCode)
  }

  const cancelChosenChannel = () => {
    setChosenChannelCode('')
    setFeedPosts([])
    setPageNum(0)
    setTimeBorders(INIT_TIME)
    setFirstLoadDone(false)
    setNoMorePosts(false)
  }

  const showLoading = loading || pinnedLoading

  return (
    <>
      {showAdd && <AddPostComponent />}
      {chosenChannelCode && <p className={[styles.chosenChannelLabel,].join(' ')}>
        <span className="colorGray">Viewing Tag:</span>
        <span>&nbsp;&nbsp;{CHANNEL_NAME_MAP[chosenChannelCode]}</span>
        <span className={[styles.cancelChannelFilter, "colorGray"].join(' ')} onClick={cancelChosenChannel}>&times;</span></p>}
      {showLoading && <p className={"colorGray"}>Loading...</p>}
      {!showLoading &&
        <div>
          {pinnedLink.id && pageNum === 0 &&
            (!chosenChannelCode || (chosenChannelCode && chosenChannelCode === pinnedLink.channelCode)) &&
            <div className={styles.pinnedHolder}>
              {renderPosts([pinnedLink], 'pinned')}
              <div className={styles.pinnedSeparator} />
            </div>}
          {renderPosts(feedPosts, 'feed')}
          {feedPosts.length === 0 &&
            <div className={styles.noPosts}>
              <p className="colorGray">No more posts</p>
            </div>
          }
          <div className={styles.nav}>
            {pageNum > 0 && <button className="actionButton actionButtonHover" onClick={loadNextPage(false)}>Prev</button>}
            {(!noMorePosts && pageNum === 0) && <span className={["colorGray", styles.pageNum].join(' ')}>{pageNum + 1}</span>}
            {!noMorePosts && <button className="actionButton actionButtonHover" onClick={loadNextPage(true)}>Next</button>}
          </div>
          <p className={[styles.src, "colorGray"].join(' ')}>Get a link feed like this for your own static site. It's <a target="_blank" rel="noopener noreferrer" href="https://github.com/brianjychan/linkfeed">open source</a></p>
          {showLogin && <SignInComponent />}
          <p onClick={() => { setShowLogin(true) }} className={[styles.login, "colorGray"].join(' ')}>© 2020</p>
        </div>
      }
      {error && <p>Looks like something broke. Please send me a message!</p>}
    </ >
  );
};



const AppWithProviders: React.FC = () => {
  const [posthogLoaded, setPosthogLoaded] = useState<any>(false)

  // Check out posthog: https://posthog.com
  useEffect(() => {
    const initPosthog = async () => {
      // @ts-ignore
      // await posthog.init("", { api_host: '' })

      setPosthogLoaded(true)
    }
    initPosthog()
  }, [])

  return (
    <UtilityContext.Provider value={new Utility()}>
      <div className={styles.view}>
        <div className={styles.title}>
          <h2>Links</h2>
          <p className="colorGray">A real-time feed of links I thought worth saving or sharing </p>
        </div>
        {posthogLoaded && <App />}
      </div>
    </UtilityContext.Provider>
  )
}

// Use this during setup so you can create an account:
// const AppWithSignUp = withAuthenticator(AppWithProviders)
// export default AppWithSignUp

// Use this in prod:
export default AppWithProviders;
