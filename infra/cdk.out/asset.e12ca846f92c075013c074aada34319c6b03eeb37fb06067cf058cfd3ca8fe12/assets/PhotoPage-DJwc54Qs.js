import{g as z,b as M,r as m,c as A,o as R,j as a,d as q,e as d,f as N,s as C,m as P,p as S,q as L,h as v,t as w,v as _,B as j,C as H,w as U,M as X,u as W,n as G,a as K}from"./index-BULYv35y.js";import{A as T}from"./Alert-B2Tvc8Vb.js";import{T as x,c as F,B as E}from"./Menu-KpVxKV4a.js";import{S as V}from"./StepHeader-yqD_W13b.js";import{s as J}from"./labels-D7NTRhye.js";import{u as Y}from"./api-Dr4sIXRf.js";import{H as Q}from"./HunterShell-CwrLTiic.js";import{S as Z}from"./Stack-B0EzxWpk.js";function ee(r){return z("MuiLinearProgress",r)}M("MuiLinearProgress",["root","colorPrimary","colorSecondary","determinate","indeterminate","buffer","query","dashed","dashedColorPrimary","dashedColorSecondary","bar","bar1","bar2","barColorPrimary","barColorSecondary","bar1Indeterminate","bar1Determinate","bar1Buffer","bar2Indeterminate","bar2Buffer"]);const k=4,I=L`
  0% {
    left: -35%;
    right: 100%;
  }

  60% {
    left: 100%;
    right: -90%;
  }

  100% {
    left: 100%;
    right: -90%;
  }
`,re=typeof I!="string"?S`
        animation: ${I} 2.1s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite;
      `:null,$=L`
  0% {
    left: -200%;
    right: 100%;
  }

  60% {
    left: 107%;
    right: -8%;
  }

  100% {
    left: 107%;
    right: -8%;
  }
`,te=typeof $!="string"?S`
        animation: ${$} 2.1s cubic-bezier(0.165, 0.84, 0.44, 1) 1.15s infinite;
      `:null,B=L`
  0% {
    opacity: 1;
    background-position: 0 -23px;
  }

  60% {
    opacity: 0;
    background-position: 0 -23px;
  }

  100% {
    opacity: 1;
    background-position: -200px -23px;
  }
`,ae=typeof B!="string"?S`
        animation: ${B} 3s infinite linear;
      `:null,ie=r=>{const{classes:e,variant:t,color:i}=r,o={root:["root",`color${d(i)}`,t],dashed:["dashed",`dashedColor${d(i)}`],bar1:["bar","bar1",`barColor${d(i)}`,(t==="indeterminate"||t==="query")&&"bar1Indeterminate",t==="determinate"&&"bar1Determinate",t==="buffer"&&"bar1Buffer"],bar2:["bar","bar2",t!=="buffer"&&`barColor${d(i)}`,t==="buffer"&&`color${d(i)}`,(t==="indeterminate"||t==="query")&&"bar2Indeterminate",t==="buffer"&&"bar2Buffer"]};return N(o,ee,e)},D=(r,e)=>r.vars?r.vars.palette.LinearProgress[`${e}Bg`]:r.palette.mode==="light"?w(r.palette[e].main,.62):_(r.palette[e].main,.5),ne=C("span",{name:"MuiLinearProgress",slot:"Root",overridesResolver:(r,e)=>{const{ownerState:t}=r;return[e.root,e[`color${d(t.color)}`],e[t.variant]]}})(P(({theme:r})=>({position:"relative",overflow:"hidden",display:"block",height:4,zIndex:0,"@media print":{colorAdjust:"exact"},variants:[...Object.entries(r.palette).filter(v()).map(([e])=>({props:{color:e},style:{backgroundColor:D(r,e)}})),{props:({ownerState:e})=>e.color==="inherit"&&e.variant!=="buffer",style:{"&::before":{content:'""',position:"absolute",left:0,top:0,right:0,bottom:0,backgroundColor:"currentColor",opacity:.3}}},{props:{variant:"buffer"},style:{backgroundColor:"transparent"}},{props:{variant:"query"},style:{transform:"rotate(180deg)"}}]}))),oe=C("span",{name:"MuiLinearProgress",slot:"Dashed",overridesResolver:(r,e)=>{const{ownerState:t}=r;return[e.dashed,e[`dashedColor${d(t.color)}`]]}})(P(({theme:r})=>({position:"absolute",marginTop:0,height:"100%",width:"100%",backgroundSize:"10px 10px",backgroundPosition:"0 -23px",variants:[{props:{color:"inherit"},style:{opacity:.3,backgroundImage:"radial-gradient(currentColor 0%, currentColor 16%, transparent 42%)"}},...Object.entries(r.palette).filter(v()).map(([e])=>{const t=D(r,e);return{props:{color:e},style:{backgroundImage:`radial-gradient(${t} 0%, ${t} 16%, transparent 42%)`}}})]})),ae||{animation:`${B} 3s infinite linear`}),se=C("span",{name:"MuiLinearProgress",slot:"Bar1",overridesResolver:(r,e)=>{const{ownerState:t}=r;return[e.bar,e.bar1,e[`barColor${d(t.color)}`],(t.variant==="indeterminate"||t.variant==="query")&&e.bar1Indeterminate,t.variant==="determinate"&&e.bar1Determinate,t.variant==="buffer"&&e.bar1Buffer]}})(P(({theme:r})=>({width:"100%",position:"absolute",left:0,bottom:0,top:0,transition:"transform 0.2s linear",transformOrigin:"left",variants:[{props:{color:"inherit"},style:{backgroundColor:"currentColor"}},...Object.entries(r.palette).filter(v()).map(([e])=>({props:{color:e},style:{backgroundColor:(r.vars||r).palette[e].main}})),{props:{variant:"determinate"},style:{transition:`transform .${k}s linear`}},{props:{variant:"buffer"},style:{zIndex:1,transition:`transform .${k}s linear`}},{props:({ownerState:e})=>e.variant==="indeterminate"||e.variant==="query",style:{width:"auto"}},{props:({ownerState:e})=>e.variant==="indeterminate"||e.variant==="query",style:re||{animation:`${I} 2.1s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite`}}]}))),ce=C("span",{name:"MuiLinearProgress",slot:"Bar2",overridesResolver:(r,e)=>{const{ownerState:t}=r;return[e.bar,e.bar2,e[`barColor${d(t.color)}`],(t.variant==="indeterminate"||t.variant==="query")&&e.bar2Indeterminate,t.variant==="buffer"&&e.bar2Buffer]}})(P(({theme:r})=>({width:"100%",position:"absolute",left:0,bottom:0,top:0,transition:"transform 0.2s linear",transformOrigin:"left",variants:[...Object.entries(r.palette).filter(v()).map(([e])=>({props:{color:e},style:{"--LinearProgressBar2-barColor":(r.vars||r).palette[e].main}})),{props:({ownerState:e})=>e.variant!=="buffer"&&e.color!=="inherit",style:{backgroundColor:"var(--LinearProgressBar2-barColor, currentColor)"}},{props:({ownerState:e})=>e.variant!=="buffer"&&e.color==="inherit",style:{backgroundColor:"currentColor"}},{props:{color:"inherit"},style:{opacity:.3}},...Object.entries(r.palette).filter(v()).map(([e])=>({props:{color:e,variant:"buffer"},style:{backgroundColor:D(r,e),transition:`transform .${k}s linear`}})),{props:({ownerState:e})=>e.variant==="indeterminate"||e.variant==="query",style:{width:"auto"}},{props:({ownerState:e})=>e.variant==="indeterminate"||e.variant==="query",style:te||{animation:`${$} 2.1s cubic-bezier(0.165, 0.84, 0.44, 1) 1.15s infinite`}}]}))),le=m.forwardRef(function(e,t){const i=A({props:e,name:"MuiLinearProgress"}),{className:o,color:b="primary",value:c,valueBuffer:s,variant:l="indeterminate",...f}=i,u={...i,color:b,variant:l},g=ie(u),y=R(),p={},h={bar1:{},bar2:{}};if((l==="determinate"||l==="buffer")&&c!==void 0){p["aria-valuenow"]=Math.round(c),p["aria-valuemin"]=0,p["aria-valuemax"]=100;let n=c-100;y&&(n=-n),h.bar1.transform=`translateX(${n}%)`}if(l==="buffer"&&s!==void 0){let n=(s||0)-100;y&&(n=-n),h.bar2.transform=`translateX(${n}%)`}return a.jsxs(ne,{className:q(g.root,o),ownerState:u,role:"progressbar",...p,ref:t,...f,children:[l==="buffer"?a.jsx(oe,{className:g.dashed,ownerState:u}):null,a.jsx(se,{className:g.bar1,ownerState:u,style:h.bar1}),l==="determinate"?null:a.jsx(ce,{className:g.bar2,ownerState:u,style:h.bar2})]})});function de(r,e){const[t,i]=m.useState(!1);return m.useEffect(()=>{if(!r)return;const o=setTimeout(()=>i(!0),e);return()=>{clearTimeout(o),i(!1)}},[r,e]),r&&t}const ue=3e3;function pe({active:r,timeoutMs:e=ue}){const t=de(r,e);return r?t?a.jsx(T,{severity:"info","data-testid":"detection-timeout",children:"判別できませんでした。手で選んでください"}):a.jsxs(j,{sx:{display:"flex",alignItems:"center",gap:1},"data-testid":"detection-waiting",children:[a.jsx(H,{size:24}),a.jsx(x,{children:"判別しています"})]}):null}const fe=F([a.jsx("circle",{cx:"12",cy:"12",r:"3.2"},"0"),a.jsx("path",{d:"M9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5"},"1")],"PhotoCamera"),me=15*1024*1024,be=["image/jpeg","image/png","image/heic","image/heif"];function ge({onPicked:r,resize:e=U,uploading:t=!1}){const[i,o]=m.useState(),b=async c=>{const s=c.target.files?.[0];if(c.target.value="",!!s){if(o(void 0),!be.includes(s.type)){o("JPEG・PNG・HEIC の写真を選んでください");return}if(s.size>me){o("写真が大きすぎます。15 MB までの写真を選んでください");return}try{r(await e(s,X))}catch{o("写真を読めませんでした。別の写真を選んでください")}}};return a.jsxs(j,{children:[i&&a.jsx(T,{severity:"error",children:i}),a.jsxs(E,{component:"label",variant:"contained",fullWidth:!0,startIcon:a.jsx(fe,{}),disabled:t,sx:{mt:2},children:["全身の写真を撮る・選ぶ",a.jsx("input",{hidden:!0,type:"file",accept:"image/jpeg,image/png,image/heic,image/heif",capture:"environment",disabled:t,onChange:b,"data-testid":"photo-input"})]}),t&&a.jsxs(j,{sx:{mt:2},"data-testid":"photo-uploading",children:[a.jsx(x,{children:"写真を送っています"}),a.jsx(le,{})]})]})}function Ie(){const{store:r}=W(),{deps:e,setDraft:t,clearDraft:i}=G(),o=K(),[b,c]=m.useState(!1),[s,l]=m.useState(),[f,u]=m.useState(),g=()=>o("/report/choice"),y=async p=>{c(!0),l(void 0),u(void 0);try{const{photoId:h,detection:n}=await Y(r.api,p);t(O=>({...O,photoId:h,autoDetectionOutcome:n?.outcome,autoDetectedSpecies:n?.species,autoDetectionConfidence:n?.confidence,species:n?.outcome==="detected"?n.species:O.species})),u(n)}catch{l("写真を送れませんでした。もう一度選んでください")}finally{c(!1)}};return a.jsxs(Q,{children:[a.jsx(V,{step:1,total:3,title:"全身の写真",onCancel:()=>{i(),o("/")}}),s&&a.jsx(T,{severity:"error",children:s}),!f&&a.jsxs(a.Fragment,{children:[a.jsx(ge,{onPicked:p=>{y(p)},resize:e.resize,uploading:b}),a.jsx(pe,{active:b})]}),f&&a.jsxs(Z,{spacing:2,sx:{mt:2},children:[f.outcome==="detected"?a.jsxs(x,{"data-testid":"detection-result",children:["AI の判定: ",J(f.species),"（",f.confidence,"%）"]}):a.jsx(x,{"data-testid":"detection-result",children:"判別できませんでした。手で選んでください"}),a.jsx(E,{variant:"contained",fullWidth:!0,onClick:g,"data-testid":"photo-next",children:"次へ"})]})]})}export{Ie as PhotoPage};
