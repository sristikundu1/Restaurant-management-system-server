const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
// app.use(cookieParser("some_secret_untold"));




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.iz3zu0d.mongodb.net/?retryWrites=true&w=majority`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const userCollection = client.db("bistroDB").collection("users");
    const menuCollection = client.db("bistroDB").collection("menu");
    const reviewCollection = client.db("bistroDB").collection("reviews");
    const cartCollection = client.db("bistroDB").collection("carts");
    const paymentCollection = client.db("bistroDB").collection("payments");



    // jwt api 
    // create token 
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1hr' })
      res.send({ token });

    })

    const varifyToken = (req, res, next) => {
      console.log('inside varify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return req.status(401).send({ message: 'forbidden access' })
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {

        if (err) {
          return req.status(401).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
      }
      )
    }


    // use varify admin after varifyToken 
    const varifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return req.status(403).send({ message: 'forbidden access' })
      }
      next();
    }

    // user api 


    // show all the data in user router in the server site
    app.get("/users", varifyToken, varifyAdmin, async (req, res) => {

      const result = await userCollection.find().toArray();//find data in array
      res.send(result);
    })


    app.get("/users/admin/:email", varifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'unauthorized access' })
      }
      const query = { email: email };

      const result = await userCollection.findOne(query);//find data in array
      res.send(result);
    })



    // insert user data in the database where there is a collection named users
    app.post("/users", async (req, res) => {
      const user = req.body;
      // insert email if user doesnot exist 
      // 3 ways to do thid(1.unique email,2.upsert,3.simple checking)

      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exist", insertedId: null })
      }

      const result = await userCollection.insertOne(user)
      res.send(result);
    })

    app.patch("/users/admin/:id", varifyToken, varifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })




    // delete data from the database where there is a collection named users
    app.delete("/users/:id", varifyToken, varifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query)
      res.send(result);
    })



    // menu related api 

    // show all the data in menu router in the server site
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();//find data in array
      res.send(result);
    })


    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.findOne(query)
      res.send(result);
    })

    app.post("/menu", varifyToken, varifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item)
      res.send(result);
    })

    app.patch("/menu/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image
        }
      }
      const result = await menuCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    // delete data from the database where there is a collection named carts
    app.delete("/menu/:id", varifyToken, varifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.deleteOne(query)
      res.send(result);
    })


    app.get("/review", async (req, res) => {
      const result = await reviewCollection.find().toArray();//find data in array
      res.send(result);
    })


    // show all the data in carts router in the server site that i added from client side
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await cartCollection.find(query).toArray();//find data in array
      res.send(result);
    })

    // insert data in the database where there is a collection named carts
    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem)
      res.send(result);
    })


    // delete data from the database where there is a collection named carts
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query)
      res.send(result);
    })



    // payment intent 

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });



    app.get("/payments/:email", varifyToken, async (req, res) => {
     
      const query = { email: req.params.email }

      if( req.params.email !== req.decoded.email ){
        return req.status(403).send({ message: 'forbidden access' })
      }
      const result = await paymentCollection.find(query).toArray();//find data in array
      res.send(result);
    })



    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      console.log('payment info',payment);
      // const query = { _id: new ObjectId(id) }
      const query = {_id: {
        $in: payment.cartIds.map(id => new ObjectId(id))
      }}
      const deleteResult = await cartCollection.deleteMany(query);
   
      res.send({paymentResult, deleteResult});
      
      // res.send(paymentResult);
    })



    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('Restaurant website server is running');
});

app.listen(port, () => {
  console.log(`Restaurant website server is running on port : ${port}`);
});