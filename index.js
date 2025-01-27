const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

//* Middleware:
app.use(cors({
  origin: [
    'http://localhost:5173', 'https://fresh-thoughts-12a68.web.app', 'https://fresh-thoughts-12a68.firebaseapp.com',
  ],
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json());
app.use(cookieParser());

//* custom middlewares:
const logger = (req, res, next) => {
  console.log('log info : ', req.method, req.url);
  next();
}

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  console.log(token);
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    console.log(decoded);
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' });
    }
    req.user = decoded;
    next();
  })
}



const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};


// ///TODO: MondoDB:

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zzvfjhd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const blogCollection = client.db("freshThoughts").collection("blogs");
    const commentCollection = client.db("freshThoughts").collection("comments");
    const wishlistCollection = client.db("freshThoughts").collection("wishlist");

    // TODO: JWT Generate :
    app.post('/jwt', logger, async (req, res) => {
      const user = req.body;
      console.log("user for token", user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '365d' })

      res.cookie('token', token, cookieOptions).send({ success: true });
    })

    // clearing Token
    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      res
        .clearCookie("token", { ...cookieOptions, maxAge: 0 })
        .send({ success: true });
    });


    //! ** blog related api **/
    //! GET
    app.get('/blogs', logger,  async (req, res) => {
      const result = await blogCollection.find().toArray();
      res.send(result);
    })

    app.get('/allBlogs', async(req, res) => {
      const {search, category} = req.query;

      const query = {};
      if (category) {
        query.category = {$regex: category, $options: 'i'};
      }
      if (search) {
        query.title = { $regex: search, $options: 'i' };
      }

      const result = await blogCollection.find(query).toArray();
      res.send(result);
    })

    app.get('/featuredBlogs', async(req, res) => {
      const result = await blogCollection.find({}).sort({ "longDescription": -1 }).limit(10).toArray();
      res.send(result);
  });

    app.get('/blogs/:id', async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      const result = await blogCollection.findOne(query);
      res.send(result);
    })

    //! POST
    app.post('/blogs', verifyToken, async (req, res) => {
      if(req.user.email !== req.body.email) {
        return res.status(403).send({message : 'forbidden access'});
      }
      const result = await blogCollection.insertOne(req.body);
      res.send(result);
    })

    //! PUT
    app.put('/blogs/:id', async (req, res) => {
      const blog = req.body;
      const filter = { _id: new ObjectId(req.params.id) };
      const options = { upsert: true };

      const updatedBlog = {
        $set: {
          title: blog.title,
          category: blog.category,
          image: blog.image,
          short_description: blog.short_description,
          long_description: blog.long_description
        }
      }
      const result = await blogCollection.updateOne(filter, updatedBlog, options);
      res.send(result);
    })


    //** comment related api **/
    //* GET
    app.get('/comments', async (req, res) => {
      const result = await commentCollection.find().toArray();
      res.send(result);
    })

    app.get('/comments/:blogId', async (req, res) => {
      const query = { blogId: req.params.blogId };
      const result = await commentCollection.find(query).toArray();
      res.send(result);
    });

    //* POST
    app.post('/comments', async (req, res) => {
      const result = await commentCollection.insertOne(req.body);
      res.send(result);
    })

    

    //* ** wishlist related api **/
    //* GET
    app.get('/wishlist', async (req, res) => {
      const result = await wishlistCollection.find().toArray();
      res.send(result);
    });

    app.get('/wishlistById/:id', async (req, res) => {
      const cursor = wishlistCollection.find({ _id: new ObjectId(req.params.id) });
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get('/wishlist/:userId', async (req, res) => {
      const cursor = wishlistCollection.find({ userId: req.params.userId });
      const result = await cursor.toArray();
      res.send(result);
    });

    //* POST 
    app.post('/wishlist/add', async (req, res) => {
        const { blogId, userId, name, email, profilePic, category, image, title, short_description, long_description } = req.body;
        const result = await wishlistCollection.insertOne({ blogId, userId, name, email, profilePic, category, image, title, short_description, long_description });
        res.send(result);
    })

    //* DELETE
    app.delete('/wishlist/:id', async(req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      const result = await wishlistCollection.deleteOne(query);
      res.send(result);
    })




    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);



app.use('/', (req, res) => {
  res.send('blog is running');
})

app.listen(port, () => {
  console.log(`server is running on port : ${port}`);
})