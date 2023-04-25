import { track, provider, category } from "sheets.js";

var wrongSegmentBinName = false;

function parseXML(xmlData, targetBinName) {
    wrongSegmentBinName = false;
    downloadedText.innerHTML = "Downloaded!";
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlData, "text/xml");
  
    console.log(`xmlDoc: ${xmlDoc.documentElement.outerHTML}`); // Debugging statement
  
    const projectElement = xmlDoc.querySelector("project");
  
    console.log(`projectElement: ${projectElement}`); // Debugging statement
  
    const childrenElements = projectElement.getElementsByTagName("children");
  
    console.log(`childrenElements: ${childrenElements.length}`); // Debugging statement
  
    let parentElement;
    for (let i = 0; i < childrenElements.length; i++) {
      const bins = childrenElements[i].getElementsByTagName("bin");
      const nameTags = childrenElements[i].getElementsByTagName("name");
      for (let j = 0; j < bins.length; j++) {
        if (nameTags[j].textContent.trim() === targetBinName) {
          parentElement = bins[j];
          break;
        }
      }
      if (parentElement) {
        break;
      }
    }
  
    if (!parentElement) {
      console.log(`No matching bin found with name '${targetBinName}'`);
      wrongSegmentBinName = true;
      downloadedText.innerHTML = "Segments Bin Name Not Found";
      return [];
    }
  
    const sequences = parentElement.getElementsByTagName("sequence");
  
    console.log(`sequences: ${sequences}`); // Debugging statement
  
    let csvData = [["Sequence Name", "Compilation Name", "Clip Name", "Clip URL", "Audio File Name"]];
  
    // Loop through each sequence
    for (let i = 0; i < sequences.length; i++) {
      const sequence = sequences[i];
      const nameElement = sequence.getElementsByTagName("name")[0];
      if (!nameElement) {
        console.log(`Skipping sequence ${i + 1} because it has no name`);
        continue; // skip sequences with no name
      }
      const sequenceName = nameElement.textContent;
  
      console.log(`Found sequence ${sequenceName}`);
  
      // Loop through each compilation in the sequence
      const compilations = sequence.getElementsByTagName("sequence");
      for (let j = 0; j < compilations.length; j++) {
        const compilation = compilations[j];
        const compilationNameElement = compilation.getElementsByTagName("name")[0];
        if (!compilationNameElement) {
          console.log(`Skipping compilation ${j + 1} because it has no name`);
          continue; // skip compilations with no name
        }
        const compilationName = compilationNameElement.textContent;
        const videoTracks = compilation.getElementsByTagName("clipitem");
  
        if (videoTracks.length === 0) {
          continue; // skip compilations with no video files
        }
  
        console.log(`Found compilation ${compilationName}`);
  
        // Get the audio file name for the compilation
          const audioElement = compilation.getElementsByTagName("audio")[0];
          if (!audioElement) {
          console.log(`Skipping compilation ${compilationName} because it has no audio`);
          continue; // skip compilations with no audio
          }
          const audioTrack = audioElement.getElementsByTagName("clipitem")[0];
          if (!audioTrack) {
          console.log(`Skipping compilation ${compilationName} because it has no audio clipitem`);
          continue; // skip compilations with no audio clipitem
          }
          const audioFileNameElement = audioTrack.getElementsByTagName("name")[0];
          if (!audioFileNameElement) {
          console.log(`Skipping compilation ${compilationName} because it has no audio file name`);
          continue; // skip compilations with no audio file name
          }
          const audioFileName = audioFileNameElement.textContent;
  
          // Loop through each video file in the compilation
          for (let k = 0; k < videoTracks.length; k++) {
            const videoTrack = videoTracks[k];
            const clipNameElement = videoTrack.getElementsByTagName("name")[0];
            if (!clipNameElement) {
                console.log(`Skipping clip ${k + 1} because it has no name`);
                continue; // skip clips with no name
            }
            const clipName = clipNameElement.textContent;
            const clipProvider = provider(clipName)
            const clipCategory = category(clipName, clipProvider)
            const clipURL = track(clipName, clipProvider, clipCategory);
    
            // Check if the audio file name is the same as the clip name
            if (audioFileName === clipName) {
                console.log(`Skipping row because Audio File Name and Clip Name are the same: ${[sequenceName, compilationName, clipName, clipURL, audioFileName]}`);
                continue;
            }
    
            csvData.push([sequenceName, compilationName, clipName, clipURL, audioFileName]);
          }
    }
    }
    // Sort csvData array by segment name (alphabetical order)
    csvData.sort((a, b) => {
        const segmentA = a[0];
        const segmentB = b[0];
        if (segmentA === "Sequence Name") {
          return -1; // Keep header row at top
        } else if (segmentB === "Sequence Name") {
          return 1; // Move header row to top
        } else {
          return segmentA.localeCompare(segmentB);
        }
      });
    
    return csvData;
  }

/**
 * Converts an XML file to CSV format and offers the resulting file for download.
 * @param {File} xmlFile - The XML file to convert to CSV format.
 * @param {string} targetBinName - The name of the XML element containing the data to convert.
 */
function convertXMLToCSV(xmlFile, targetBinName) {
    // Parse the XML data into an array of arrays representing the CSV data
    console.log("parseXML() was called")
    const csvData = parseXML(xmlFile, targetBinName);
  
    // Construct a filename for the CSV file by replacing the input file's extension with .csv
    const fileName = xmlFile.name.replace(/\.[^/.]+$/, "") + ".csv";
  
    // Convert the CSV data to a string with rows separated by commas and columns separated by newlines
    const csvContent = "data:text/csv;charset=utf-8," + csvData.map(row => row.join(",")).join("\n");
  
    // Encode the CSV content for use in a hyperlink
    const encodedUri = encodeURI(csvContent);
  
    // Create a new link element to simulate a download of the CSV file
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
  
    // Append the link to the document body and simulate a click to trigger the download
    document.body.appendChild(link); // Required for Firefox
    link.click();
    document.body.removeChild(link);
  }
  
  const convertBtn = document.getElementById("convert-btn");
  convertBtn.addEventListener("click", Convert);
  
  function Convert() {
    const xmlFile = document.getElementById("xml-file").files[0];
    console.log(xmlFile);
    if (!xmlFile) {
      alert("Please upload an XML file.");
      return;
    }
  
    const targetBinName = document.getElementById("bin-name").value;
  
    // Use a FileReader object to read the contents of the XML file as text
    const reader = new FileReader();
    reader.onload = function(event) {
      const xmlData = event.target.result;
      console.log(`xmlData: ${xmlData}`); // Debugging statement
  
      // Call the parseXML function with the XML data
      const csvData = parseXML(xmlData, targetBinName);
  
      // Construct a filename for the CSV file by replacing the input file's extension with .csv
      const fileName = xmlFile.name.replace(/\.[^/.]+$/, "") + ".csv";
  
      // Convert the CSV data to a string with rows separated by commas and columns separated by newlines
      const csvContent = "data:text/csv;charset=utf-8," + csvData.map(row => row.join(",")).join("\n");
  
      // Encode the CSV content for use in a hyperlink
      const encodedUri = encodeURI(csvContent);
  
      // Create a new link element to simulate a download of the CSV file
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", fileName);
  
      if (wrongSegmentBinName === false) {
        // Append the link to the document body and simulate a click to trigger the download
        document.body.appendChild(link); // Required for Firefox
        link.click();
        document.body.removeChild(link);
      } else {
        downloadedText.innerHTML = "Segments Bin Name Not Found";
        return;
      }
    }
    reader.readAsText(xmlFile);
  }

const convertXmlToCsvBtn = document.getElementById("convert-btn");
const downloadedText = document.getElementById("downloaded-text");

convertXmlToCsvBtn.addEventListener("click", () => {
  const xml = document.getElementById("xml-file").files[0];
  const binName = document.getElementById("bin-name").value;

  downloadedText.classList.remove("hidden");
});
