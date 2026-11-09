"""Original 48px pixel artwork, authored as layered pixels for the Aseprite bridge."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PALETTE = {
    '.':'#00000000', 'o':'#191824', 'i':'#302838', 'd':'#353449',
    'm':'#50516A', 'h':'#777D92', 's':'#BDC4CD', 'w':'#F4EADB',
    'k':'#9B6254', 't':'#CF8D69', 'f':'#F1B780', 'l':'#FFDAA3',
    'b':'#8A4C28', 'a':'#C27A28', 'g':'#ECAA32', 'y':'#FFD052', 'z':'#FFF19B',
    'p':'#73334F', 'r':'#BA4E6B', 'v':'#E47B8C', 'e':'#FF7846',
    'c':'#A7BCCB', 'q':'#D8E1DD', 'u':'#677E91'
}
layers=[]
def layer(name):
    canvas=[['.']*48 for _ in range(48)]
    layers.append((name,canvas));return canvas
def rect(c,x1,y1,x2,y2,col):
    for y in range(y1,y2+1):
        for x in range(x1,x2+1):c[y][x]=col
def line(c,x1,y1,x2,y2,col):
    steps=max(abs(x2-x1),abs(y2-y1))
    for n in range(steps+1):
        x=round(x1+(x2-x1)*n/max(1,steps));y=round(y1+(y2-y1)*n/max(1,steps));c[y][x]=col
def poly(c,points,col):
    # Pixel-centre scan conversion, then explicit integer boundary.
    for y in range(min(p[1] for p in points),max(p[1] for p in points)+1):
        for x in range(min(p[0] for p in points),max(p[0] for p in points)+1):
            inside=False;j=len(points)-1
            for i,(xi,yi) in enumerate(points):
                xj,yj=points[j]
                if (yi>y+.5)!=(yj>y+.5) and x+.5<(xj-xi)*(y+.5-yi)/(yj-yi)+xi:inside=not inside
                j=i
            if inside:c[y][x]=col
    for a,b in zip(points,points[1:]+points[:1]):line(c,*a,*b,col)

c=layer('01 Boots & tapered trousers')
poly(c,[(18,32),(30,32),(30,38),(28,43),(31,44),(31,46),(23,46),(22,43),(22,38),(20,43),(20,45),(12,45),(12,43),(16,41),(16,36)],'o')
poly(c,[(19,34),(23,34),(21,39),(19,42),(16,42),(18,37)],'d')
line(c,19,35,18,39,'m');line(c,17,41,19,41,'h')
poly(c,[(24,34),(29,34),(28,39),(26,43),(23,43),(24,39)],'i')
line(c,27,35,26,39,'m');line(c,24,40,26,40,'d')
rect(c,14,43,19,44,'d');rect(c,12,45,20,45,'h');rect(c,14,43,16,43,'s')
rect(c,24,44,28,45,'d');rect(c,24,46,31,46,'h');rect(c,25,44,26,44,'s')

c=layer('02 Skin · face and neck')
poly(c,[(21,11),(29,11),(32,14),(32,17),(34,18),(34,19),(32,20),(32,22),(29,24),(28,26),(23,26),(21,23),(21,20),(18,18),(18,14)],'o')
poly(c,[(22,13),(29,13),(31,15),(31,18),(33,18),(33,19),(31,20),(31,22),(28,23),(27,25),(24,25),(23,22),(21,20),(20,17)],'t')
poly(c,[(25,13),(29,14),(30,16),(30,19),(31,20),(30,22),(27,23),(24,21),(24,17)],'f')
line(c,29,15,30,16,'l');rect(c,19,16,21,19,'k');rect(c,20,16,21,18,'f')
line(c,24,23,27,24,'k');line(c,29,22,30,21,'k')
# Heavy eyebrow, one visible amber eye, shaved-side mark and small ear stud.
line(c,27,16,30,16,'o');rect(c,28,17,30,17,'w');c[17][29]='a'
line(c,24,14,25,16,'b');line(c,23,15,23,17,'b');c[19][21]='s'
line(c,29,20,31,20,'o')

c=layer('03 Leather jacket silhouette')
poly(c,[(20,23),(22,22),(25,25),(28,24),(29,23),(33,25),(35,29),(35,33),(32,35),(29,34),(29,36),(16,36),(15,34),(12,34),(11,31),(13,26),(16,24)],'o')
poly(c,[(16,25),(21,24),(23,27),(28,25),(31,25),(33,29),(32,32),(29,33),(28,35),(17,35),(15,32),(13,32),(14,27)],'d')
poly(c,[(23,26),(27,26),(28,33),(21,34),(21,29)],'p')
rect(c,24,28,26,31,'r');line(c,24,28,25,28,'v')
# Asymmetric lapels, shoulder rim and sleeves.
poly(c,[(20,24),(23,27),(20,29),(22,30),(18,34),(17,29)],'m')
line(c,17,25,16,28,'h');line(c,20,25,21,26,'s')
poly(c,[(28,24),(30,25),(28,29),(26,30),(27,26)],'h')
line(c,28,26,27,29,'s');line(c,16,30,14,32,'m')
rect(c,12,31,14,33,'i');line(c,13,34,15,34,'s')
poly(c,[(30,26),(32,27),(34,31),(32,33),(30,32)],'i')
line(c,32,28,33,30,'m');rect(c,31,32,33,32,'m')
# Left relaxed hand.
rect(c,12,35,15,36,'o');rect(c,13,35,15,36,'t');rect(c,14,35,15,35,'f')

c=layer('04 Gold swept spikes')
poly(c,[(16,16),(15,13),(17,11),(14,10),(19,9),(18,6),(22,7),(23,3),(26,6),(29,3),(29,7),(33,6),(32,10),(35,10),(32,13),(30,14),(29,12),(26,13),(23,15),(21,15),(20,18),(18,18),(18,15)],'o')
poly(c,[(17,13),(19,11),(17,10),(21,10),(20,8),(23,9),(24,5),(26,8),(28,6),(28,9),(31,8),(30,11),(32,11),(29,13),(28,11),(25,13),(22,14),(20,15),(19,17),(18,15)],'g')
poly(c,[(18,11),(22,11),(21,9),(24,10),(25,7),(26,10),(29,9),(28,11),(25,12),(22,13),(20,13)],'y')
line(c,21,11,24,11,'z');line(c,25,9,25,10,'z');line(c,27,10,28,10,'z')
line(c,18,13,19,15,'a');line(c,21,13,22,12,'a');c[11][30]='a'

c=layer('05 Metal hardware & chain')
for x,y in [(15,25),(17,24),(19,24),(30,25),(31,26)]:c[y][x]='s'
line(c,19,31,18,34,'s');c[32][19]='w';c[34][17]='h'
rect(c,18,35,28,35,'i');rect(c,23,34,25,35,'s');c[34][24]='o'
for x,y in [(28,34),(29,35),(29,36),(28,37),(27,38),(25,38),(24,37)]:c[y][x]='s'
for x,y in [(28,35),(28,36),(26,38)]:c[y][x]='h'
# Small warm patch, readable without text.
rect(c,14,27,16,29,'p');line(c,15,27,16,28,'r')

c=layer('06 Cigarette & ember')
line(c,32,20,37,20,'o');line(c,32,19,37,19,'w');c[19][36]='t';c[19][38]='e';c[20][38]='b'

c=layer('07 Smoke curl')
for x,y in [(39,17),(40,16),(40,15),(39,14),(38,13),(38,12),(39,11),(40,10)]:c[y][x]='u'
for x,y in [(39,16),(39,15),(38,14),(37,13),(37,12),(38,11),(39,10)]:c[y][x]='c'
c[10][40]='q';c[9][40]='c';c[8][39]='u'

spec={'width':48,'height':48,'durations_ms':[100],'palette':PALETTE,
      'layers':[{'name':n,'frames':[{'rows':[''.join(row) for row in c]}]} for n,c in layers]}
out=ROOT/'assets';out.mkdir(exist_ok=True)
(out/'punk-logo.pixels.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2),encoding='utf-8')
print(out/'punk-logo.pixels.json')
