function getCurrentWindowTabs() {
  return browser.tabs.query({currentWindow: true});
}

function getHostName(url) {
  let urlObj = new URL(url)
  if (urlObj.hostname.length == 0)
    return null
  return urlObj.hostname.length > 15 ? urlObj.hostname.substr(0, 15) + '...' : urlObj.hostname
}

// <div class="empyt-panel" id="empyt-panel">
// <img src="/images/Illustration.png" />
// <h1>Set aside your tabs</h1>
// <p>Click on the <b>Create New Session</b> button to set aside your tabs. Restore them later to pick up where you left off.</p>
// </div>
function addEmptyBanner () {
  let bannerExisting = document.getElementById('empyt-panel')
  if (!bannerExisting) {
    let banner = document.createElement('div')
    banner.setAttribute('class', 'empyt-panel')
    banner.setAttribute('id', 'empyt-panel')
    banner.innerHTML = `
      <img src="/images/Illustration.png" />
      <h1>Set aside your tabs</h1>
      <p>Click on the <b>Create New Session</b> button to set aside your tabs. Restore them later to pick up where you left off.</p>
    `.trim()
    const panelList = document.querySelector('.panel-list')
    panelList.appendChild(banner)
  }
}

function removeEmptyBanner () {
  let banner = document.getElementById('empyt-panel')
  if (banner) banner.parentNode.removeChild(banner)
}

const logStorageChange = (changes, area) => {
  if (Object.keys(changes['panel-list'].newValue).length > 0) {
    removeEmptyBanner()
  } else {
    addEmptyBanner()
  }
}
browser.storage.onChanged.addListener(logStorageChange);

function setListsFromMemory () {
  browser.storage.local.get('panel-list').then(item => {
    const panelList = document.querySelector('.panel-list')
    
    if (item) {
      if (item['panel-list'] && Object.keys(item['panel-list']).length > 0) {
        removeEmptyBanner()
      } else {
        removeEmptyBanner()
        addEmptyBanner()
      }
  
      if (item['panel-list']) {
        Object.keys(item['panel-list']).forEach(timestamp => {
          const panelInstace = createPanelInstace(timestamp)
          panelInstace.appendChild(createPanelInfo(Object.keys(item['panel-list'][timestamp]).length, parseInt(timestamp)))
          const panels = document.createElement('div')
          panels.setAttribute('class', 'panels')
          
          let panelInfoArray = item['panel-list'][timestamp].sort(function (a, b) {
            return a.index - b.index
          })
          panelInfoArray.forEach(panelInfo => {
            let panel = document.createElement('div');
            panel.setAttribute('class', 'panel')
            panel.setAttribute('onclick', `openTab(${panelInfo.url})`)
            panel.setAttribute('id', '' + timestamp + panelInfo.id)
            panel.innerHTML = `
            <span onclick="openTab(${panelInfo.url})">
              <p onclick="openTab(${panelInfo.url})">${panelInfo.title}</p>
              <img
                onclick="removeTabFromSession(${timestamp}, ${panelInfo.id})"
                src="./icons/cross.svg"
              />
            </span>
            `.trim()
            panel.setAttribute('style', `background-image: url(${panelInfo.thumbnail});`)
            panels.appendChild(panel);
          })
    
          panelInstace.appendChild(panels)
          panelList.appendChild(panelInstace)
        })
      }
    } else {
      addEmptyBanner()
    }
  })
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(function () {
    setListsFromMemory()
  }, 500)
});

function savePanelInstance (timestamp, panelData) {
  browser.storage.local.get('panel-list').then(item => {
    let objTemp
    if (!item['panel-list']) {
      objTemp = {}
    } else {
      objTemp = item['panel-list']
    }
    objTemp['' + timestamp] = panelData
    browser.storage.local.set({ 'panel-list': objTemp }).then(() => {
      let indices = panelData.map(x => x.id)
      browser.tabs.create({}).then(function (tab) {
        browser.tabs.update(tab.id, {
          active: true
        }).then (() => {
          var discarding = browser.tabs.remove(indices);
        }, err => console.log(err));
      }, err => console.log(err))
    })
  })
}

function removeSession (e, timestamp) {
  panelInstance = document.getElementById(timestamp)
  panelInstance.parentNode.removeChild(panelInstance)
}

function restoreTabs (e, timestamp, dontSkipOpening = true) {
  removeSession(e, timestamp)
  browser.storage.local.get('panel-list').then(item => {
    if (dontSkipOpening) {
      item['panel-list'][timestamp].forEach(tab => {
        browser.tabs.create({ url: tab.url });
      })
    }
    let tempLocal = item['panel-list']
    delete tempLocal[timestamp]
    browser.storage.local.set({'panel-list': tempLocal})
  })
}

function listTabs(timestamp, panelInstace) {
  const panelList = document.querySelector('.panel-list')
  const panels = document.createElement('div')
  panels.setAttribute('class', 'panels')
  let count = 0
  let loadedCount = 0
  let panelData = []
  
  getCurrentWindowTabs().then((tabs) => {
    count = tabs.length
    tabs.forEach((tab, index) => {
      let tabTitle = getHostName(tab.url)
      if (!tabTitle && tab.title && tab.title.length > 0) tabTitle = tab.title.substr(0, 15).split(' ')[0]
      else if (!tabTitle) tabTitle = tab.id

      let panel = document.createElement('div');
      panel.setAttribute('class', 'panel')
      panel.setAttribute('id', '' + timestamp + tab.id)
      panel.setAttribute('onclick', `openTab(${tab.url})`)
      panel.innerHTML = `
      <span onclick="openTab(${tab.url})">
        <p onclick="openTab(${tab.url})">${tabTitle}</p>
        <img
          onclick="removeTabFromSession(${timestamp}, ${tab.id})"
          src="./icons/cross.svg"
        />
      </span>
      `.trim()

      var capturing = browser.tabs.captureTab(tab.id);
      capturing.then(
        function (imageURI) {
          loadedCount++
          panel.setAttribute('style', `background-image: url(${imageURI});`)
          panelData.push({
            title: tabTitle,
            thumbnail: imageURI,
            url: tab.url,
            index,
            id: tab.id
          })
          if (loadedCount == count) {
            savePanelInstance(timestamp, panelData)
          }
        }, err => console.log(err));

      panels.appendChild(panel);
    })
  }).then(() => {
    panelInstace.appendChild(createPanelInfo(count, timestamp))
    panelInstace.appendChild(panels)
    panelList.appendChild(panelInstace)
    
    // browser.storage.local.set({'testing': 'success'})
    // if (browser.storage.StorageArea.get('testing')) console.log(browser.storage.StorageArea.get('testing'))
    // else browser.storage.StorageArea.set('testing', 'success')
  });
  return { panels, count }
}
// <div class="panel-instance">
// <div class="panel-info">
//   <div class="panel-info-l">
//     <span>1 tab</span>
//     <span>Just Now</span>
//   </div>
//   <div class="panel-info-r">
//     <span>Restore tabs</span>
//     <img src="./icons/cross.svg" />
//   </div>
// </div>
// <div class="panels">
//   <div class="panel">
//     <span>
//       <p>Google</p><img src="./icons/cross.svg" /></span>
//   </div>
// </div>
// </div>

const createPanelInstace = timestamp => {
  const panelInstace = document.createElement('div')
  panelInstace.setAttribute('id', timestamp)
  panelInstace.setAttribute('class', 'panel-instance')
  
  const psl = document.createElement('div')
  psl.setAttribute('class', "panels-scroll-left")
  psl.setAttribute('onclick', "scrollLeft()")
  psl.innerHTML = `<img src="icons/left-arrow-chevron.svg" onclick="scrollLeft()" />`

  const psr = document.createElement('div')
  psr.setAttribute('class', "panels-scroll-right")
  psr.setAttribute('onclick', "scrollRight()")
  psr.innerHTML = `<img src="icons/left-arrow-chevron.svg" onclick="scrollRight()" />`

  panelInstace.appendChild(psl)
  panelInstace.appendChild(psr)
  
  return panelInstace
}

const createPanelInfo = (numberOfTabs, timestamp) => {
  const panelInfo = document.createElement('div')
  panelInfo.setAttribute('class', 'panel-info')

  // Create and populate the left section of the panel
  const panelLeft = document.createElement('div')
  panelLeft.setAttribute('class', 'panel-info-l')
  const span1PanelLeft = document.createElement('span')
  span1PanelLeft.innerHTML = `${numberOfTabs} ${(numberOfTabs == 1) ? 'tab' : 'tabs'}`
  const span2PanelLeft = document.createElement('span')
  let dateTemp = new Date(timestamp)
  span2PanelLeft.innerHTML = dateTemp.toLocaleString()
  panelLeft.appendChild(span1PanelLeft)
  panelLeft.appendChild(span2PanelLeft)

  // Create and populate the right section of the panel
  const panelRight = document.createElement('div')
  panelRight.setAttribute('class', 'panel-info-r')
  const span1PanelRight = document.createElement('span')
  span1PanelRight.innerHTML = 'Restore tabs'
  span1PanelRight.setAttribute('onclick', `restoreTabs(${timestamp})`)
  const deleteIcon = document.createElement('img')
  deleteIcon.setAttribute('src', './icons/cross.svg')
  deleteIcon.setAttribute('onclick', `removeSession(${timestamp})`)
  panelRight.appendChild(span1PanelRight)
  panelRight.appendChild(deleteIcon)

  panelInfo.appendChild(panelLeft)
  panelInfo.appendChild(panelRight)

  return panelInfo
}

const createSessionTabs = () => {
  const timestamp = Date.now()
  const panelInstace = createPanelInstace(timestamp)
  // const { panels, count } =
  removeEmptyBanner()
  listTabs(timestamp, panelInstace)
  // panelInstace.appendChild(createPanelInfo(timestamp))
  // panelInstace.appendChild(panels)
  // panelList.appendChild(panelInstace)
}

function openTab (url) {
  browser.tabs.create({ url })
}

document.addEventListener("click", (e) => {
  if (e.target.getAttribute('onclick')) {
    if (e.target.getAttribute('onclick') == 'saveSession()' ) createSessionTabs()
    else if (e.target.getAttribute('onclick') == 'scrollLeft()') scrollLeft(e)
    else if (e.target.getAttribute('onclick') == 'scrollRight()') scrollRight(e)
    else if (e.target.getAttribute('onclick').indexOf('restoreTabs') != -1) restoreTabs(e, e.target.getAttribute('onclick').split('(')[1].split(')')[0])
    else if (e.target.getAttribute('onclick').indexOf('removeSession') != -1) restoreTabs(e, e.target.getAttribute('onclick').split('(')[1].split(')')[0], false)
    else if (e.target.getAttribute('onclick').indexOf('openTab') != -1) openTab(e.target.getAttribute('onclick').split('(')[1].split(')')[0])
    else if (e.target.getAttribute('onclick').indexOf('removeTabFromSession') != -1) removeTabFromSession(e.target.getAttribute('onclick').split('(')[1].split(')')[0])
  }
})

function removeTabFromSession (params) {
  let paramsSplit = params.split(',')
  paramsSplit = paramsSplit.map(x => x.trim())
  const timestamp = paramsSplit[0]
  const tabId = paramsSplit[1]
  const node = document.getElementById(`${timestamp}${tabId}`)
  node.parentNode.removeChild(node)

  browser.storage.local.get('panel-list').then(item => {
    let objTemp = item['panel-list']
    objTemp['' + timestamp] = objTemp['' + timestamp].filter(x => x.id != tabId)
    if (objTemp['' + timestamp].length == 0)
      restoreTabs(null, timestamp, false)
    else
      browser.storage.local.set({ 'panel-list': objTemp }).then(() => {
    })
  })

}

const scrollLeft = e => {
  let panels
  if (e.target.parentNode.querySelector('.panels')) panels = e.target.parentNode.querySelector('.panels')
  else if (e.target.parentNode.parentNode.querySelector('.panels')) panels = e.target.parentNode.parentNode.querySelector('.panels')
  if (panels) {
    if (panels.scrollLeft > 0) {
      if (panels.scrollLeft < panels.offsetWidth) {
        panels.scrollTo({
          left: 0,
          behavior: 'smooth'
        })
      } else {
        panels.scrollTo({
          left: panels.scrollLeft - panels.offsetWidth,
          behavior: 'smooth'
        })
      }
    }
  }
}


const scrollRight = e => {
  let panels
  if (e.target.parentNode.querySelector('.panels')) panels = e.target.parentNode.querySelector('.panels')
  else if (e.target.parentNode.parentNode.querySelector('.panels')) panels = e.target.parentNode.parentNode.querySelector('.panels')
  if (panels) {
    if (panels.scrollLeft < panels.scrollWidth) {
      if (panels.scrollLeft > panels.offsetWidth * Math.floor(panels.scrollWidth / panels.offsetWidth)) {
        panels.scrollTo({
          left: panels.scrollWidth,
          behavior: 'smooth'
        })
      } else {
        panels.scrollTo({
          left: panels.scrollLeft + panels.offsetWidth,
          behavior: 'smooth'
        })
      }
    }
  }
}