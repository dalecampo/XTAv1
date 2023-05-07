import { track, provider, category, needsClipId } from "./sheets.js";

//
const downloadedText = document.getElementById("downloaded-text");
var correctSegmentBinName = true;
var foundSegmentsInBin = true;
var channelSelected = false;

// PARSE THE XML FILE AND REFORMAT ROWS ARRAY

function parseXML(xmlData, userBinName) {
    correctSegmentBinName = true;
    foundSegmentsInBin = true;
    channelSelected = true;

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlData, "text/xml");  
    const projectElement = xmlDoc.querySelector("project");
    const childrenElements = projectElement.getElementsByTagName("children");
    let SegmentsBinElement;
    
    // Find the <bin> element whose name matches userNameBin and assign it to SegmentsBinElement.
    const bins = xmlDoc.getElementsByTagName("bin");
    SegmentsBinElement = Array.from(bins).find((bin) => {
      const nameTag = bin.getElementsByTagName("name")[0];
      return nameTag && nameTag.textContent.trim() === userBinName;
    });

    // If the user's Segments Bin Name does not match a bin name in their XML, exit parseXML.
    if (!SegmentsBinElement) {
      correctSegmentBinName = false;
      return [];
    }

    // If the user has not changed the default Channel dropdown, exit parseXML.
    if (document.getElementById("channel-dropdown").value === "Select Channel") {
      channelSelected = false;
      return [];
    }
  
    // Create the rows array.
    const rows = [];

    // Find all sequence elements in SegmentsBinElement and assign to segments variable.
    //const segments = SegmentsBinElement.getElementsByTagName("sequence");
    
    const childrenElement = SegmentsBinElement.getElementsByTagName("children")[0];
    const segments = [];

    // Add all sequence elements nested in SegmentsBinElement to segments array.
    if (!childrenElement) {
      foundSegmentsInBin = false;
      return [];
    } else {    
      for (let i = 0; i < childrenElement.children.length; i++) {
        const childNode = childrenElement.children[i];    
        if (childNode.tagName === "sequence") {
          segments.push(childNode);
        }
      }
    }

    // SEGMENT ----------

    // Loop through each segment's sequence element
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentNameElement = segment.getElementsByTagName("name")[0];
      
      if (!segmentNameElement) {
        //console.log(`Skipping segment ${i + 1} because it has no name.`);
        continue; // skip segments with no name
      }

      const segmentName = segmentNameElement.textContent;
      console.log("");
      console.log('%cSEGMENT %d: %s', 'font-weight: bold;', i + 1, segmentName);

      // Find all sequence elements ("comp" elements) in the segment and assign to comps variable
      const comps = segment.getElementsByTagName("sequence");

      // COMP ----------

      // Loop through each comp in the segment
      for (let j = 0; j < comps.length; j++) {
        const comp = comps[j];
        const compNameElement = comp.getElementsByTagName("name")[0];

        if (!compNameElement) {
          //console.log(`Skipping comp ${j + 1} because it has no name.`);
          continue; // skip comps with no name
        }

        const compName = compNameElement.textContent;
        console.log("");
        console.log(`COMP: ${compName}`);
        
        // Store all video and audio elements in clipItemElements.
        const clipItemElements = Array.from(comp.getElementsByTagName("clipitem"));

        // Store video elements in videoElements.
        const videoElements = clipItemElements.filter(videoElement => {
          const videoMediaElement = videoElement.getElementsByTagName("media")[0];
          if (videoMediaElement) {
            return videoMediaElement.getElementsByTagName("video").length > 0;
          }
          return false;
        });
        //console.log(`Found ${videoElements.length} video elements in ${compName}`);

        // Skip comps with no video files.
        if (videoElements.length === 0) {
          continue;
        }   

        // AUDIO ---------- modify it to focus on the longest audio file

        // Store audio elements in audioElements.
        const audioElements = clipItemElements.filter(audioElement => {
          const audioMediaElement = audioElement.getElementsByTagName("media")[0];
          if (audioMediaElement) {
            return audioMediaElement.getElementsByTagName("audio").length > 0;
          }
          return false;
        });

        let longestDuration = 0;
        let audioFileName = ''; // Changed variable name from longestAudioFileName to audioFileName

        // Iterate through each audio element and find the longest one.
        for (let k = 0; k < audioElements.length; k++) {
          const audioElement = audioElements[k];
          const durationElement = audioElement.getElementsByTagName("duration")[0];

          if (!durationElement) {
            continue; // skip audio elements without a duration
          }

          const duration = parseFloat(durationElement.textContent);

          // Update longestDuration and audioFileName if the current duration is greater.
          if (duration > longestDuration) {
            longestDuration = duration;
            const nameElement = audioElement.getElementsByTagName("file")[0]?.getElementsByTagName("name")[0];
            audioFileName = nameElement ? nameElement.textContent : '';
          }
        }

        console.log("Audio File:");
        console.log(audioFileName);
        console.log("Video Files:");

        // VIDEOS & REMAINING INFO ----------

        // Keep track of which clip names were already used in this comp
        const processedClipNames = [];

        // Loop through each video file in the comp. Create one row per video file.
        for (let k = 0; k < videoElements.length; k++) {
          const videoElement = videoElements[k];
          const clipNameElement = videoElement.getElementsByTagName("name")[0];

          if (!clipNameElement) {
            console.log(`Skipping clip ${k + 1} because it has no name`);
            continue; // skip clips with no name
          }
          
          const clipName = clipNameElement.textContent;

          // Rows with these file names should be skipped in tracking.
          const skipValues = [
            "ATM Bug (Right).png",
            "ATM Bug (Left).png",
            "Attribution"
          ];

          // Get the file name from the <track><clipitem><file><name> value
          const fileNameElement = videoElement.getElementsByTagName("file")[0]?.getElementsByTagName("name")[0];
          const fileName = fileNameElement ? fileNameElement.textContent : '';

          // SKIP THIS ROW IF ITS FILE NAME...
          // ...contains any string from the skipValues list.
          if (skipValues.some(skipValue => fileName.includes(skipValue))) {
            console.log(`Skipping ${fileName}`);
            continue;
          }
          // ...matches its audioFileName (This prevents duplicate rows in a comp's tracking).
          if (audioFileName === clipName) {
            console.log("Skipping row because Audio File Name and Clip Name are the same.");
            continue;
          }
          // ...was already tracked in this comp.
          if (processedClipNames.includes(clipName)) {
            console.log(`Skipping ${clipName} (already tracked in ${compName}).`);
            continue;
          }

          // Add the clipName value to the list of processed clip names for the current comp
          processedClipNames.push(clipName);
          console.log(clipName);

          // CELLS IN THIS ROW ----------
          
          // Channel
          const channel = document.getElementById("channel-dropdown").value;
          // Provider
          let clipProvider = null;
          clipProvider = provider(clipName)          
          // Clip ID
          let clipId = null;
          clipId = needsClipId(clipProvider);
          // Category
          let clipCategory = null;
          clipCategory = category(clipName, clipProvider)
          // Clip URL
          const clipURL = track(clipName, clipProvider, clipCategory);
          // Date cell (reformatted from "yyyy-mm-dd" to "mm/dd/yyyy")
          const rawDate = document.getElementById("date").value;
          const dateObj = new Date(rawDate);
          const date = (dateObj.getMonth() + 1) + '/' + dateObj.getDate() + '/' + dateObj.getFullYear();       

          // CREATE A NEW ROW FOR THIS CLIPNAME
          const newRow = [
            `"${segmentName}"`,
            `"${compName}"`,
            `"${clipName}"`,
            `"${clipURL}"`,
            `"${audioFileName}"`,
            channel,
            clipId,
            clipProvider,
            clipCategory,
            date
          ];

          // ADD ^THIS ROW^ TO THE ROWS ARRAY
          rows.push(newRow);
        }
      }

      // SORT ROWS BY SEGMENT NAME (A->Z)
      rows.sort((a, b) => {
        const segmentA = a[0];
        const segmentB = b[0];
        if (segmentA && segmentB) {
          return segmentA.localeCompare(segmentB);
        }
        return 0;
      });
    }
  const headerRow = ["Segment Name", "Comp Name", "Clip Name", "Clip URL", "Audio File Name", "Channel", "Clip ID", "Provider", "Category", "Date"];
  rows.unshift(headerRow);
  console.log(rows);
  return rows;
}
  
// When the user clicks Convert XML to CSV, execute Convert().
const convertBtn = document.getElementById("convert-btn");
convertBtn.addEventListener("click", Convert);

// CONVERT XML TO CSV ----------

function Convert() {
  const xmlFile = document.getElementById("xml-file").files[0];
  const userBinName = document.getElementById("bin-name").value;
  
  // Show an error if the user did not upload an XML file.
  if (!xmlFile) {
    downloadedText.innerHTML = "Upload an XML File";
    return;
  }

  // Use a FileReader object to read the contents of the XML file as text
  const reader = new FileReader();
  reader.onload = function(event) {
    const xmlData = event.target.result;
    const csvData = parseXML(xmlData, userBinName);

    // Construct a filename for the CSV file by replacing the input file's extension with .csv.
    const fileName = xmlFile.name.replace(/\.[^/.]+$/, "") + ".csv";

    // Convert the CSV data to a string with rows separated by commas and columns separated by newlines.
    const csvContent = "data:text/csv;charset=utf-8," + csvData.map(row => row.join(",")).join("\n");

    // Encode the CSV content for use in a hyperlink.
    const encodedUri = encodeURI(csvContent);

    // Create a new link element to simulate a download of the CSV file
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);

    // If the user selected a viable Segments Bin and Channel, download the file.
    if (correctSegmentBinName === true && channelSelected === true) {
      // Append the link to the document body and simulate a click to trigger the download
      document.body.appendChild(link); // Required for Firefox
      link.click();
      document.body.removeChild(link);
      downloadedText.innerHTML = "Downloaded!";
    } else if (correctSegmentBinName === false) {
      downloadedText.innerHTML = `'${userBinName}' Not Found`;
      return;
    } else if (foundSegmentsInBin === false) {
      downloadedText.innerHTML = `${userBinName} Has No Sequences`;
      return;
    } else if (channelSelected === false) {
      downloadedText.innerHTML = "Select a Channel";
      return;
    }
  }
  reader.readAsText(xmlFile);
}
