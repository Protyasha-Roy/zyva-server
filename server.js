const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const { ObjectId } = require('mongodb');
require('dotenv').config();



const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(cors());
app.use(express.json());

// MongoDB connection
const mongoURI = process.env.mongoURI;

mongoose.connect(mongoURI);
const connection = mongoose.connection;
connection.once('open', () => {
  console.log('MongoDB database connection established successfully');
});

app.get('/', (req, res) => {
  res.send('Hello, World!');
});


app.post('/createFilesAndFolders', async (req, res) => {
  const receivedData = req.body;
  const fileType = receivedData.fileType;

  try {
    switch (fileType) {
      case 'folder':
        const foundFolder = await connection.collection('filesAndFoldersCollection').findOne({
          title: receivedData.title,
          email: receivedData.email,
          isFolder: receivedData.isFolder
        });

        if (foundFolder) {
          res.status(409).json({ message: 'Folder with this name already exists' });
        } else {
          await connection.collection('filesAndFoldersCollection').insertOne(receivedData);
          res.status(200).json({ message: 'Folder created successfully' });
        }
        break;

      case 'singleNote':
        const foundSingleNote = await connection.collection('filesAndFoldersCollection').findOne({
          title: receivedData.title,
          email: receivedData.email,
          isSingleNote: receivedData.isSingleNote
        });

        if (foundSingleNote) {
          res.status(409).json({ message: 'Note with this name already exists' });
        } else {
          await connection.collection('filesAndFoldersCollection').insertOne(receivedData);
          res.status(200).json({ message: 'Note created successfully' });
        }
        break;

      case 'noteInsideFolder':
        const noteExists = await connection.collection('filesAndFoldersCollection').findOne({
          'customId': receivedData.belongsToFolderId,
          'notes': { $elemMatch: { 'title': receivedData.title, 'email': receivedData.email, isNoteInsideFolder: receivedData.isNoteInsideFolder } }
        });

        if (noteExists) {
          res.status(409).json({ message: 'Note with this name already exists inside the folder' });
        } else {
          await connection.collection('filesAndFoldersCollection').updateOne(
            { customId: receivedData.belongsToFolderId },
            { $push: { notes: receivedData } }
          );
          res.status(200).json({ message: 'Note created successfully inside the folder' });
        }
        break;

      default:
        break;
    }

  } catch (error) {
    console.error('Error processing data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.get('/allFilesAndFolders/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const documents = await connection.collection('filesAndFoldersCollection').find({ userId: userId }).toArray();
    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.get('/note/:customId/:parentId', async (req, res) => {
  const customId = req.params.customId;
  const parentId = req.params.parentId;
  try {
    if(!parentId.includes('-')) {
      const foundNoteInDoc = await connection.collection('filesAndFoldersCollection').find({_id: new ObjectId(parentId)}).toArray();
      res.json(foundNoteInDoc[0]);
    }

    else {
      const foundParentFolder = await connection.collection('filesAndFoldersCollection').find({
        'customId': parentId,
        'notes': { $elemMatch: { 'customId': customId } }
      }).toArray();

      const foundNoteInTheFolder = foundParentFolder[0].notes.find(note => note.customId === customId);

      res.json(foundNoteInTheFolder);
    }

  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/updateContent/:parentId/:customId/:isSingleNote', async (req, res) => {
  const customId = req.params.customId;
  const parentId = req.params.parentId;
  const isSingleNote = req.params.isSingleNote;
  
  try {
    if(isSingleNote === 'true') {
      await connection.collection('filesAndFoldersCollection').findOneAndUpdate(
        {_id: new ObjectId(parentId)},
        {$set: {content: req.body.contentToUpdate}}
      );
      res.status(200).json({ message: 'updated' });
    }

    else {
      await connection.collection('filesAndFoldersCollection').findOneAndUpdate({
        customId: parentId,
        'notes': { $elemMatch: { 'customId': customId } }
      },
      {
        $set: {
          'notes.$.content': req.body.contentToUpdate
        }
      });
      res.status(200).json({ message: 'updated' });
    }

  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.delete('/delete/:parentId/:customId/:isSingleNote', async (req, res) => {
  const customId = req.params.customId;
  const parentId = req.params.parentId;
  const isSingleNote = req.params.isSingleNote;
  
  try {
    if(isSingleNote === 'true') {
      await connection.collection('filesAndFoldersCollection').findOneAndDelete(
        {_id: new ObjectId(parentId)},
      );
      res.status(200).json({ message: 'Note created successfully' });
    }

    else {
      await connection.collection('filesAndFoldersCollection').updateOne({
        customId: parentId,
        'notes': { $elemMatch: { 'customId': customId } }
      },
      {
        $pull: {
          'notes': {'customId': customId}
        }
      });
      res.status(200).json({ message: 'Note created successfully' });
    }

  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.post('/signup', async (req, res) => {
  const { name, email, password, userId } = req.body;

  try {
    // Check if the email already exists
    const existingUser = await connection.collection('users').findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }
  
     // Create a new user
      await connection.collection('users').insertOne({ name, email, password, userId });
  
      res.status(201).json({ message: 'User created successfully' });
    
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


app.post('/signin', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find the user by email
    const user = await connection.collection('users').findOne({ email });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.status(200).json({ message: 'Signin successful', userSignedIn: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


app.delete('/deleteFolder/:customId', async (req, res) => {
  const customId = req.params.customId;
 
  try {
      await connection.collection('filesAndFoldersCollection').findOneAndDelete(
        {customId: customId},
      );
      res.status(200).json({ message: 'Note created successfully' });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
