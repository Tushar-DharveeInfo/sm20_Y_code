/*

using data already loaded in cache (from tables) you will create follwoing fn to return dataset as shown here; use these fn to get dataset to create respective charts in dashboards
You can assume other props of charts as you see fit;
we need bar chart for each of these datasets
*/

function getRandomInt(min:number, max:number): number 
{
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const newbusinesses = ()=>
{
    // Implementation for newbusinesses goes here
    return {"30": getRandomInt(5, 96), // for this row get count of businesses added in last 30 days
            "60": getRandomInt(5, 96),
            "90": getRandomInt(5, 96), 
            "120": getRandomInt(5, 96)}
}

const businessesNotContacted = ()=>
{
    // Implementation for businessesNotContacted goes here
    return {"30": getRandomInt(5, 96), // for this row get count of businesses not contacted in last 30 days
            "60": getRandomInt(5, 96),
            "90": getRandomInt(5, 96), 
            "120": getRandomInt(5, 96)}
}
const AmcExpiring = ()=>
{
    // Implementation for AmcExpiring goes here
    return {"30": getRandomInt(5, 96), // for this row get count of AMCs expiring in last 30 days
            "60": getRandomInt(5, 96),
            "90": getRandomInt(5, 96), 
            "120": getRandomInt(5, 96)}
}

const McsExpiring = ()=>
{
    // Implementation for McsExpiring goes here
    return {"30": getRandomInt(5, 96), // for this row get count of MCS expiring in last 30 days
            "60": getRandomInt(5, 96),
            "90": getRandomInt(5, 96), 
            "120": getRandomInt(5, 96)}
}

const SaasExpiring = ()=>
{
    // Implementation for SaasExpiring goes here
    return {"30": getRandomInt(5, 96), // for this row get count of SaaS expiring in last 30 days
            "60": getRandomInt(5, 96),
            "90": getRandomInt(5, 96), 
            "120": getRandomInt(5, 96)}
}


const OnPremisesExpiring = ()=>
{
    // Implementation for OnPremisesExpiring goes here
    return {"30": getRandomInt(5, 96), // for this row get count of On-Premises expiring in last 30 days
            "60": getRandomInt(5, 96),
            "90": getRandomInt(5, 96), 
            "120": getRandomInt(5, 96)}
}

const statistics = ()=>
{
    // Implementation for statistics goes here
    return {"Users": getRandomInt(5, 96),   //for this row get count of users
            "Racks": getRandomInt(5, 96),   //for this row get count of racks
            "DCSites": getRandomInt(5, 96)}  //for this row get count of DC sites
}


    console.log(AmcExpiring());

export { AmcExpiring, McsExpiring, SaasExpiring, OnPremisesExpiring, newbusinesses, businessesNotContacted, statistics };