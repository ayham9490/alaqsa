
const SUPABASE_URL = "YOUR_SUPABASE_URL"
const SUPABASE_KEY = "YOUR_PUBLIC_KEY"

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

async function saveTransaction(){

let type=document.getElementById("type").value
let account=document.getElementById("account").value
let weight=document.getElementById("weight").value
let density=document.getElementById("density").value
let price=document.getElementById("price").value

await client.from("transactions").insert({
type:type,
account:account,
weight:weight,
density:density,
price:price,
date:new Date()
})

loadTransactions()
}

async function loadTransactions(){

let {data}=await client.from("transactions").select("*")

let body=document.querySelector("#table tbody")
body.innerHTML=""

data.forEach(t=>{

let row=`
<tr>
<td>${t.date}</td>
<td>${t.type}</td>
<td>${t.account}</td>
<td>${t.weight}</td>
<td>${t.price}</td>
</tr>
`

body.innerHTML+=row

})

}

loadTransactions()
