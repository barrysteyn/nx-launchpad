def handler(event, context):
    return {"statusCode": 200, "body": "Hello from example-python-cli!"}


def main() -> None:
    print("Hello from example-python-cli!")


if __name__ == "__main__":
    main()
