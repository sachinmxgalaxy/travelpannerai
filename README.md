Travel Planner AI: The AI That Plans Your Next Trip
Website Purpose - Assisting the user in planning their trips through:
General Description of the place the user wants to visit
Recommendation of worthwhile tourist attractions to assist the user planning their vacation days
Recommendation of trusted hotels in the area the user is visiting
Accurate weather forecasting on the days the user specifies they will be visiting
Designed day-to-day itinerary using all previous shown data
How To Run Locally:
(Disclaimer: To use travelplannerai, you must have a personal api key to a large language model, and a gmail account)
Download the following to your computer: app.js, frontend.html, server.py, styles.css, .env
Edit the .env file; paste in your personal api key between the quotations of the variable “API_KEY”
Make an account at “weatherapi.com” to obtain an api key (account made through clicking sign up)
Paste in your weather api into the .env file
Clone the files into vs code.
Run server.py, copy and paste the link you get into a browser
Research Paper:
We used the paper: Choice Overload during Travel Decision Making for Self vs. Other (by Nguyen T. Thai from the University of Wollongong, Australia)
The paper’s central proposition was that, contrary to the logic that more choices maximizes value by allowing the individual to pick the best from the largest amount of options, more choice in travel often impacts travel negatively. This is because the increased amount of choices results in a choice paralysis: a state where the traveler is unable to make a choice because it’s too difficult to decide. This is exacerbated when an individual traveler is making choices for themselves versus recommending for others. When the traveler chooses attractions for themselves, they are in a mindset of minimizing loss; the mindset causes them to be more wary and hesitant. The result is further difficulties in choice. The conclusions reached in the paper are the ones the our project tries to address exactly. By providing a curated list of attractions, our AI removes the feeling of choice overload from the travel experience. Furthermore, the section on the exacerbation of difficulties when one is in a mindset of choosing for oneself directly impacted the travel itinerary function of our website. By filtering out overwhelming information into a structured, optimized plan, the feature reduces cognitive friction and minimizes the feeling that the traveler made the “wrong decision”.  
Partner Contributions:
Sachin Jagat:
Backend coder: internal logic of the program, file splitting, and overall code organization
Coordination with api keys: led effort to find and use relevant APIs
Server setup: set up relevant structure for code to run in web browser
Ori Karni:
Ideator: constructed idea of layout and program functionality
Primary front end coding: worked with ai to design optimal front end to fit functionality
Research: Found research to back up idea and came up with layout to fit research conclusions
Working With An AI Agent:
Ori Karni:
Many of the prompts I used for AI were about a specific vision of the website I had in my head. When prompting, I made sure to thoughtfully tell it about specific features I wanted the front end to have such as the calendar pop up when picking dates, or the fact that the weather should be shown for all days the tourist is traveling. I think what worked well was the large scale architecture of the website. The AI was very good at taking my general vision of the start screen, selection of place, and showcasing places to travel. At the same time, it was also somewhat difficult to get the details right. One bug I came across was that you could input a day in the past or go from a future day to a past day when selecting dates. The AI would generate results all the same. Another issue we stumbled upon was that the AI had issues finding real hotels in each place and would just keep recycling the same hotel names. The debugging process was done through a very specific targeting of the issue and telling the AI to reconstruct the website around the solution. For the hotel issue, we just realized we needed a separate hotel finding API call. What I learned about prompting is that as long as you have a good idea of the front end you want, the AI will generally be able to construct the main, big parts of the website well. However, there is a significant stage of debugging for the smaller, more specific issues. The AI struggles a lot more to tackle this stuff and sometimes specific, more targeted prompting is needed to address very specific issues. What I would do differently if I had to start over the project is re-evaluate the completion timeline around fixing these smaller bugs to account for AI difficulties, probably scheduling entire work sessions around working with the AI on small problems ahead of time. I would also keep good note of which smaller features are absolutely necessary so as to not waste time on irrelevant features.
Sachin Jagat:
We used the LLM model to get the places, prices and destinations of hotels and attractions. We also used it to build the front end and work with some parts of the backend. Primarily, we used it to work with animations and styling of the website. It worked well in terms of producing a really nice front end and it was pretty efficient at it (as in it took like 20 mins). However, it made some careless mistakes with Flask in the backend that I had to fix manually, as my partner worked on the frontend. I learned that, with prompting, you have to mention specific problems and talk in terms of things you have discussed with it earlier for the best result possible. To be honest, I would have probably put some more features if we did it another time, as it has a lot of potential.
