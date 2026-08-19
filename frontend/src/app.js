import{createSearchPage}from'./pages/searchPage.js';import{createWatchPage}from'./pages/watchPage.js';
function notify(message){const toast=document.querySelector('#toast');toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2500);}
let watchPage;function navigate(view){document.querySelectorAll('.view').forEach(item=>item.classList.toggle('active',item.id===view));document.querySelectorAll('.nav').forEach(item=>item.classList.toggle('active',item.dataset.view===view));if(view==='mypage')watchPage.load();scrollTo(0,0);}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>navigate(button.dataset.view)));
createSearchPage({navigate,notify});watchPage=createWatchPage({notify});
