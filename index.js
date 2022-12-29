//username=dgeniuscar
//passwors=0Job4pmgrlHdIw92
//whiteless ip address
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express=require('express');
const cors=require('cors');
const SSLCommerzPayment = require('sslcommerz-lts')
const jwt=require('jsonwebtoken');

require('dotenv').config();
const app=express();
const port=process.env.PORT || 5000;

//ssl commerce
const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASSWD;
const is_live = false
//middleware
app.use(cors());
app.use(express.json());






//const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.bje6fgv.mongodb.net/?retryWrites=true&w=majority`;
// console.log(uri)
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
   const authHeader = req.headers.authorization;

   if (!authHeader) {
       return res.status(401).send({ message: 'unauthorized access' });
   }
   const token = authHeader.split(' ')[1];

   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
       if (err) {
           return res.status(403).send({ message: 'Forbidden access' });
       }
       req.decoded = decoded;
       next();
   })
}


// function verifyJWT(req,res,next){
//    const authHeader=req.headers.authorization;
//    if(!authHeader){
//       res.status(401).send({message:'unauthorize access'});

//    }
//    const token=authHeader.split(' ')[1];
//    jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,function(err,decoded){

//       if(err){
//          res.status(401).send({message:'unauthorized access'})
//       }
//       req.decoded=decoded;
//       next();
//    })
// }

 async function run(){

    try{
           const userCollection=client.db('geniusCar').collection('services');//servicsecollection
           const orderCollection=client.db('geniusCar').collection('orders');

             //get jwt token
           //verify jwt
           app.post('/jwt',async(req,res)=>{
            const user=req.body;
            //console.log(user)
            const token=jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'});
            res.send({token})
           })

         app.get('/services', async(req,res)=>{
            const query={};
            const cursor=userCollection.find(query);
            const services= await cursor.toArray();
            res.send(services);

         });

         app.get('/services/:id',async(req,res)=>{

            const id=req.params.id;
            const query={_id:ObjectId(id)};
            const service =await userCollection.findOne(query);
            res.send(service);
         });


         //order api

        // orders api
        app.get('/orders', verifyJWT, async (req, res) => {
         const decoded = req.decoded;

         if (decoded.email !== req.query.email) {
             res.status(403).send({ message: 'unauthorized access' })
         }

         let query = {};
         if (req.query.email) {
             query = {
                 email: req.query.email
             }
         }
         const cursor = orderCollection.find(query);
         const orders = await cursor.toArray();
         res.send(orders);
     });

         app.post('/orders', async(req,res)=>{

            const order=req.body;
            // const result= await orderCollection.insertOne(order);
            // res.send(result);

               const orderService=await userCollection.findOne({_id:ObjectId(order.service)})
               //console.log(orderService);
               const transectionId= new ObjectId().toString();
            const data = {
               total_amount: orderService.price,
               currency: order.currency,
               tran_id:transectionId, // use unique tran_id for each api call
               success_url: `https://gniuscar-node-mongo-curd-server.vercel.app/payment/success?transectionId=${transectionId}`,
               fail_url: `https://gniuscar-node-mongo-curd-server.vercel.app/payment/fail?transectionId=${transectionId}`,
               cancel_url: 'https://gniuscar-node-mongo-curd-server.vercel.app/payment/cancel',
               ipn_url: 'http://localhost:3030/ipn',
               shipping_method: 'Courier',
               product_name: 'Computer.',
               product_category: 'Electronic',
               product_profile: 'general',
               cus_name: order.customer,
               cus_email: order.email,
               cus_add1: order.address,
               cus_add2: 'Dhaka',
               cus_city: 'Dhaka',
               cus_state: 'Dhaka',
               cus_postcode: order.postcode,
               cus_country: 'Bangladesh',
               cus_phone: '01711111111',
               cus_fax: '01711111111',
               ship_name: 'Customer Name',
               ship_add1: 'Dhaka',
               ship_add2: 'Dhaka',
               ship_city: 'Dhaka',
               ship_state: 'Dhaka',
               ship_postcode: 1000,
               ship_country: 'Bangladesh',
           };
           //console.log(data);
           //res.send(data)
           const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
           sslcz.init(data).then(apiResponse => {
               // Redirect the user to payment gateway
               let GatewayPageURL = apiResponse.GatewayPageURL
               orderCollection.insertOne({
                  ...order,
                  price: orderService.price,
                  transectionId,
                  paid:false
               });
               res.send({url:GatewayPageURL});
               //console.log('Redirecting to: ', GatewayPageURL)
           });
         });
             //payment-success
         app.post('/payment/success', async (req,res)=>{
               
            const {transectionId}=req.query;
            //console.log(transectionId);
            if(!transectionId){
               return res.redirect('https://genius-car-4b4da.web.app/fail')
            }
            const result= await orderCollection.updateOne({transectionId},{$set:
               
               {
                  paid:true,paidAt:new Date()
               }
            });
           if(result.modifiedCount>0){
            res.redirect( `https://genius-car-4b4da.web.app/success?transectionId=${transectionId}`)
           }

         });
        //get payment inform
        app.get('/orders/:by-transection-id/:id',async(req,res)=>{
        const {id}=req.params;
        const order=await orderCollection.findOne({transectionId:id});
        //console.log(id,order)
        res.send(order);


        });

        //payment delet
        app.post('/payment/fail',async(req,res)=>{

         const{transectionId}=req.query;
         if(!transectionId){
            return res.redirect('https://genius-car-4b4da.web.app/fail')
         }
         const result=await orderCollection.deleteOne({transectionId});
         if(result.deletedCount){
            res.redirect('https://genius-car-4b4da.web.app/fail');
         }
        })
         app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        });
        app.patch('/orders/:id', async (req, res) => {
         const id = req.params.id;
         const status=req.body.status
         const query = { _id: ObjectId(id) };
         const updateDoc={
            $set:{
               status:status
            }
         }
         const result=await orderCollection.updateOne(query,updateDoc);
         res.send(result);
     })

                

        
         
    }
    finally{

    }

}
run().catch(err=>console.log(err));

app.get('/',(req,res)=>{
    res.send("Hellow feom");
});

app.listen(port,()=>{

    console.log(`listing poort ${port}`);
})
