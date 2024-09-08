import os
import dotenv

dotenv.load_dotenv()

if not os.environ.get("OPENAI_API_KEY"):
    os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY")

os.environ["LANGCHAIN_TRACING_V2"] = "true"
if not os.environ.get("LANGCHAIN_API_KEY"):
    os.environ["LANGCHAIN_API_KEY"] = os.getenv("LANGCHAIN_API_KEY")


from langchain_openai import ChatOpenAI



from langchain.tools.retriever import create_retriever_tool
from langchain_chroma import Chroma
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent
from langchain_community.document_loaders import PyPDFLoader

memory = MemorySaver()
llm = ChatOpenAI(model="gpt-4o-mini")


# Load, chunk and index the contents of the blog.
file_path = (
    "content/shit.pdf"
)
loader = PyPDFLoader(file_path)
docs = loader.load()

### Construct retriever ###
if not os.path.exists("./chroma_langchain_db"):
    os.makedirs("./chroma_langchain_db")
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
splits = text_splitter.split_documents(docs)
vectorstore = Chroma.from_documents(documents=splits,
                                    embedding=OpenAIEmbeddings(),
                                    persist_directory="./chroma_langchain_db")


retriever = vectorstore.as_retriever()


### Build retriever tool ###
tool = create_retriever_tool(
    retriever,
    "BIT_rules_retriever",
    "Searches and returns excerpts from BIT rules book.",
)
tools = [tool]


agent_executor = create_react_agent(llm, tools, checkpointer=memory)


query = "What are some of the mess rules?"


def returnResponse(input, session_id):
    inputs = {"messages": [("user", input)]}
    config = {"configurable": {"thread_id": str(session_id)}}
    response = agent_executor.invoke(inputs, config=config)["messages"][-1].content
    print(response)
    return response